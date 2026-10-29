import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

beforeEach(() => {
  tokenStorage.setSession(session);
});

afterEach(() => {
  tokenStorage.clear();
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
});
