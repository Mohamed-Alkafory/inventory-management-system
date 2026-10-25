import { describe, expect, it } from "vitest";
import { DEFAULT_QUERY, hasActiveFilters, parseProductQuery, toSearchParams } from "./productQuery";

const parse = (qs: string) => parseProductQuery(new URLSearchParams(qs));

describe("product query <-> URL", () => {
  it("uses the defaults for an empty URL", () => {
    expect(parse("")).toEqual(DEFAULT_QUERY);
  });

  it("reads every filter from the URL", () => {
    expect(parse("q=mouse&category=Accessories&stock=low_stock&sort=price&dir=desc&page=3&size=20")).toEqual({
      search: "mouse",
      category: "Accessories",
      status: "low_stock",
      sortBy: "price",
      sortDir: "desc",
      page: 3,
      pageSize: 20,
    });
  });

  it("ignores invalid values instead of breaking", () => {
    const q = parse("stock=banana&sort=password&dir=desc&page=-4&size=999");
    expect(q.status).toBe("");
    expect(q.sortBy).toBeNull();
    expect(q.sortDir).toBe("asc");
    expect(q.page).toBe(1);
    expect(q.pageSize).toBe(DEFAULT_QUERY.pageSize);
  });

  it("round-trips and leaves defaults out of the URL", () => {
    expect(toSearchParams(DEFAULT_QUERY).toString()).toBe("");

    const query = { ...DEFAULT_QUERY, search: "usb c", status: "out_of_stock" as const, sortBy: "stock" as const, page: 2 };
    expect(parseProductQuery(toSearchParams(query))).toEqual(query);
  });

  it("only counts search / category / stock as filters", () => {
    expect(hasActiveFilters(parse("sort=name&page=2&size=50"))).toBe(false);
    expect(hasActiveFilters(parse("q=a"))).toBe(true);
    expect(hasActiveFilters(parse("category=Audio"))).toBe(true);
    expect(hasActiveFilters(parse("stock=in_stock"))).toBe(true);
  });
});
