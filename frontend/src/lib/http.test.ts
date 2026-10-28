import { afterEach, describe, expect, it, vi } from "vitest";
import { request } from "./http";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => {
  vi.unstubAllGlobals();
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
});
