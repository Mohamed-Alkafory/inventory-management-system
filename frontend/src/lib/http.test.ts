import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onSessionExpired } from "../api/authEvents";
import { tokenStorage } from "../api/tokenStorage";
import { publicRequest, request, requestBlob } from "./http";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const session = {
  accessToken: "access-old",
  refreshToken: "refresh-1",
  user: { id: "u1", email: "user@example.com", name: "User", role: "STAFF" as const },
};

beforeEach(() => {
  tokenStorage.setSession(session);
});

afterEach(() => {
  vi.unstubAllGlobals();
  tokenStorage.clear();
});

describe("request", () => {
  it("does not force a JSON Content-Type for FormData bodies", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "p1" }));
    vi.stubGlobal("fetch", fetchMock);

    const body = new FormData();
    body.append("image", new File(["pixels"], "photo.png", { type: "image/png" }));

    await request("/products/p1/image", { method: "POST", body });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Headers;
    // The browser must be allowed to add the multipart boundary itself.
    expect(headers.has("Content-Type")).toBe(false);
    expect(init.body).toBe(body);
    expect(init.method).toBe("POST");
  });

  it("keeps the JSON Content-Type for regular requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "p1" }));
    vi.stubGlobal("fetch", fetchMock);

    await request("/products", { method: "POST", body: JSON.stringify({ name: "Pen" }) });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Headers;
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("refreshes an expired access token once and replays the request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: "Unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ accessToken: "access-new", refreshToken: "refresh-2" }))
      .mockResolvedValueOnce(jsonResponse({ data: [], meta: { total: 0 } }));
    vi.stubGlobal("fetch", fetchMock);

    const body = await request("/users?page=1");

    expect(body).toEqual({ data: [], meta: { total: 0 } });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/\/auth\/refresh$/);

    const refreshInit = fetchMock.mock.calls[1][1] as RequestInit;
    expect(refreshInit.method).toBe("POST");
    expect(refreshInit.body).toBe(JSON.stringify({ refreshToken: "refresh-1" }));

    const retryInit = fetchMock.mock.calls[2][1] as RequestInit;
    expect((retryInit.headers as Headers).get("Authorization")).toBe("Bearer access-new");
    expect(tokenStorage.getAccessToken()).toBe("access-new");
    expect(tokenStorage.getRefreshToken()).toBe("refresh-2");
  });

  it("signs the user out when the refresh is refused", async () => {
    const listener = vi.fn();
    const unsubscribe = onSessionExpired(listener);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: "Unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ message: "Invalid refresh token" }, 401));
    vi.stubGlobal("fetch", fetchMock);

    await expect(request("/users")).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(tokenStorage.getSession()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("shares a single refresh between concurrent 401s (rotation is single-use)", async () => {
    let protectedCalls = 0;
    let refreshCalls = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/auth/refresh")) {
        refreshCalls += 1;
        return jsonResponse({ accessToken: "access-new" });
      }
      protectedCalls += 1;
      return protectedCalls <= 2 ? jsonResponse({ message: "Unauthorized" }, 401) : jsonResponse({ ok: true });
    });
    vi.stubGlobal("fetch", fetchMock);

    const [a, b] = await Promise.all([request("/users"), request("/products")]);

    expect(refreshCalls).toBe(1);
    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
  });

  it("does not replay an auth endpoint with a refresh", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: "Invalid credentials" }, 401));
    vi.stubGlobal("fetch", fetchMock);

    await expect(request("/auth/login", { method: "POST" })).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(tokenStorage.getAccessToken()).toBe("access-old");
  });
});

describe("publicRequest", () => {
  it("never attaches the stored token, even when a session exists", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ received: true }, 201));
    vi.stubGlobal("fetch", fetchMock);

    const body = await publicRequest("/contact", {
      method: "POST",
      body: JSON.stringify({ name: "Jane" }),
      headers: { Authorization: "Bearer leaked" },
    });

    expect(body).toEqual({ received: true });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Headers).has("Authorization")).toBe(false);
  });

  it("does not refresh or sign the user out on 401", async () => {
    const listener = vi.fn();
    const unsubscribe = onSessionExpired(listener);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: "Unauthorized" }, 401));
    vi.stubGlobal("fetch", fetchMock);

    await expect(publicRequest("/contact")).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(tokenStorage.getAccessToken()).toBe("access-old");
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});

describe("requestBlob", () => {
  it("returns the raw response with the bearer token so callers can read the file", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("SKU,Name\n", { status: 200, headers: { "Content-Type": "text/csv" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await requestBlob("/reports/inventory.csv");

    expect(await res.text()).toBe("SKU,Name\n");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer access-old");
  });

  it("keeps the server's validation message on a failed download", async () => {
    const message = "Date range must not exceed 92 days";
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message }, 400));
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestBlob("/reports/sales.csv")).rejects.toMatchObject({
      status: 400,
      serverMessage: message,
    });
  });
});
