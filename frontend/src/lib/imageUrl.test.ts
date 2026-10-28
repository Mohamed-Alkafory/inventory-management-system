import { describe, expect, it } from "vitest";
import { resolveImageUrl } from "./imageUrl";

describe("resolveImageUrl", () => {
  it("returns null for empty or missing values", () => {
    expect(resolveImageUrl(null)).toBeNull();
    expect(resolveImageUrl(undefined)).toBeNull();
    expect(resolveImageUrl("")).toBeNull();
    expect(resolveImageUrl("   ")).toBeNull();
  });

  it("keeps external http(s) URLs unchanged", () => {
    expect(resolveImageUrl("https://cdn.example.com/product.png")).toBe("https://cdn.example.com/product.png");
    expect(resolveImageUrl("http://cdn.example.com/product.png")).toBe("http://cdn.example.com/product.png");
  });

  it("prepends the origin of an absolute API URL to relative upload paths", () => {
    expect(resolveImageUrl("/uploads/products/abc.webp", "https://api.example.com/api/v1")).toBe(
      "https://api.example.com/uploads/products/abc.webp",
    );
    // The /api/v1 prefix is NOT part of the image URL.
    expect(resolveImageUrl("/uploads/products/abc.webp", "https://api.example.com/api/v1")).not.toContain("/api/v1");
  });

  it("keeps relative paths when the API URL is relative (Vite dev proxy)", () => {
    expect(resolveImageUrl("/uploads/products/abc.png", "/api/v1")).toBe("/uploads/products/abc.png");
  });

  it("leaves other schemes alone", () => {
    expect(resolveImageUrl("blob:http://localhost/uuid")).toBe("blob:http://localhost/uuid");
    expect(resolveImageUrl("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
  });
});
