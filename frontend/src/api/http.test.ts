import { AxiosError } from "axios";
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_RETRIES,
  REQUEST_TIMEOUT_MS,
  RETRY_DELAYS_MS,
  getSlowRequestState,
  resetColdStart,
} from "../lib/coldStart";
import { http } from "./http";
import { tokenStorage } from "./tokenStorage";

const session = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  user: { id: "u1", email: "user@example.com", name: "User", role: "STAFF" as const },
};

function captureAdapter() {
  const calls: InternalAxiosRequestConfig[] = [];
  const adapter: AxiosAdapter = async (config) => {
    calls.push(config);
    return { data: {}, status: 200, statusText: "OK", headers: {}, config };
  };
  return { calls, adapter };
}

function ok(config: InternalAxiosRequestConfig): AxiosResponse {
  return { data: { ok: true }, status: 200, statusText: "OK", headers: {}, config };
}

function failure(config: InternalAxiosRequestConfig, status: number): AxiosError {
  const response: AxiosResponse = {
    data: { message: `HTTP ${status}` },
    status,
    statusText: "",
    headers: {},
    config,
  };
  return new AxiosError("Request failed", AxiosError.ERR_BAD_RESPONSE, config, undefined, response);
}

beforeEach(() => {
  tokenStorage.setSession(session);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  tokenStorage.clear();
  resetColdStart();
});

describe("axios http client", () => {
  it("does not force the JSON Content-Type for FormData bodies", async () => {
    const { calls, adapter } = captureAdapter();
    const body = new FormData();
    body.append("image", new File(["pixels"], "avatar.png", { type: "image/png" }));

    await http.post("/users/me/avatar", body, { adapter });

    // The browser must add multipart/form-data with its own boundary.
    expect(calls[0].headers.get("Content-Type")).not.toBe("application/json");
    expect(calls[0].headers.get("Authorization")).toBe("Bearer access-token");
    expect(calls[0].data).toBe(body);
  });

  it("keeps the JSON Content-Type for regular requests", async () => {
    const { calls, adapter } = captureAdapter();

    await http.post("/auth/me", { name: "User" }, { adapter });

    expect(calls[0].headers.get("Content-Type")).toBe("application/json");
  });

  it("uses the 45 second cold-start timeout", () => {
    expect(http.defaults.timeout).toBe(REQUEST_TIMEOUT_MS);
  });
});

describe("axios cold-start handling", () => {
  it("retries a GET after a 503 and returns the successful response", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const adapter: AxiosAdapter = async (config) => {
      calls += 1;
      if (calls === 1) throw failure(config, 503);
      return ok(config);
    };

    const promise = http.get("/products", { adapter });
    const assertion = expect(promise).resolves.toMatchObject({ status: 200 });

    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]);
    await assertion;

    expect(calls).toBe(2);
    // Retries share one tracking window, so nothing is left in flight.
    expect(getSlowRequestState()).toEqual({ waking: false, pending: 0 });
  });

  it("retries twice with 1s then 3s backoff", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const adapter: AxiosAdapter = async (config) => {
      calls += 1;
      if (calls <= MAX_RETRIES) throw failure(config, 502);
      return ok(config);
    };

    const promise = http.get("/products", { adapter });
    const assertion = expect(promise).resolves.toMatchObject({ status: 200 });

    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]);
    expect(calls).toBe(2);

    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[1]);
    await assertion;
    expect(calls).toBe(3);
  });

  it("retries a GET after a network error", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const adapter: AxiosAdapter = async (config) => {
      calls += 1;
      if (calls === 1) throw new AxiosError("Network Error", "ECONNREFUSED", config);
      return ok(config);
    };

    const promise = http.get("/products", { adapter });
    const assertion = expect(promise).resolves.toMatchObject({ status: 200 });

    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]);
    await assertion;

    expect(calls).toBe(2);
  });

  it("never retries a POST after a 503", async () => {
    let calls = 0;
    const adapter: AxiosAdapter = async (config) => {
      calls += 1;
      throw failure(config, 503);
    };

    await expect(http.post("/orders", {}, { adapter })).rejects.toMatchObject({ status: 503 });
    expect(calls).toBe(1);
  });

  it.each([404, 409])("does not retry a %i response", async (status) => {
    let calls = 0;
    const adapter: AxiosAdapter = async (config) => {
      calls += 1;
      throw failure(config, status);
    };

    await expect(http.get("/products/p1", { adapter })).rejects.toMatchObject({ status });
    expect(calls).toBe(1);
  });

  it("keeps the existing 401 refresh replay unchanged", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ accessToken: "access-new", refreshToken: "refresh-2" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    let calls = 0;
    const adapter: AxiosAdapter = async (config) => {
      calls += 1;
      if (calls === 1) throw failure(config, 401);
      return ok(config);
    };

    await expect(http.get("/users", { adapter })).resolves.toMatchObject({ status: 200 });

    expect(calls).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(tokenStorage.getAccessToken()).toBe("access-new");
    expect(tokenStorage.getRefreshToken()).toBe("refresh-2");
  });
});
