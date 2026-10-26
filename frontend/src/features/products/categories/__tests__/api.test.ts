import { afterEach, describe, expect, it, vi } from "vitest";
import { realCategoriesApi } from "../api";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("realCategoriesApi", () => {
  it("maps the UI pagination fields to the API's page/limit query params", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [{ id: "cat-1", name: "Electronics" }],
        meta: { page: 2, limit: 10, total: 11, totalPages: 2 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const page = await realCategoriesApi.list({ search: " elec ", page: 2, pageSize: 10 });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/categories\?page=2&limit=10&search=elec$/),
      expect.objectContaining({ credentials: "include" }),
    );
    expect(page).toEqual({ items: [{ id: "cat-1", name: "Electronics", productCount: 0 }], total: 11 });
  });

  it("updates a category with PATCH", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "cat-1", name: "Home" }));
    vi.stubGlobal("fetch", fetchMock);

    await realCategoriesApi.update("cat-1", { name: "Home" });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/categories\/cat-1$/),
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ name: "Home" }) }),
    );
  });
});
