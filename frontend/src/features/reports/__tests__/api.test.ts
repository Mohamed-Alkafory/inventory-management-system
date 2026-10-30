import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadReport, filenameFromContentDisposition, fallbackFilename } from "../api";
import type { DateRange } from "../types";

const mocks = vi.hoisted(() => ({ requestBlob: vi.fn() }));

vi.mock("../../../lib/http", () => ({ requestBlob: mocks.requestBlob }));

const range: DateRange = { from: "2026-10-01", to: "2026-10-30" };

const response = (body: string, headers: Record<string, string> = {}) =>
  new Response(body, { status: 200, headers: { "Content-Type": "text/csv", ...headers } });

beforeEach(() => mocks.requestBlob.mockReset());
afterEach(() => vi.clearAllMocks());

describe("report downloads", () => {
  it("uses the filename from Content-Disposition and returns the blob", async () => {
    mocks.requestBlob.mockResolvedValue(
      response("SKU,Name\nWM-204,Wireless Mouse\n", {
        "Content-Disposition": 'attachment; filename="inventory-2026-10-30.csv"',
      }),
    );

    const file = await downloadReport("inventory", range);

    expect(file.filename).toBe("inventory-2026-10-30.csv");
    expect(await file.blob.text()).toContain("Wireless Mouse");
    expect(mocks.requestBlob).toHaveBeenCalledWith("/reports/inventory.csv");
  });

  it("sends the UTC date bounds for range-aware reports", async () => {
    mocks.requestBlob.mockResolvedValue(response("Order,Total\n"));

    await downloadReport("sales", range);

    const url = mocks.requestBlob.mock.calls[0][0] as string;
    expect(url.startsWith("/reports/sales.csv?")).toBe(true);
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("from")).toBe("2026-10-01T00:00:00.000Z");
    expect(params.get("to")).toBe("2026-10-30T23:59:59.999Z");
  });

  it("falls back to a sensible filename when the header is missing", async () => {
    mocks.requestBlob.mockResolvedValue(response("Order,Total\n"));

    const sales = await downloadReport("sales", range);
    expect(sales.filename).toBe("sales-2026-10-01_2026-10-30.csv");

    mocks.requestBlob.mockResolvedValue(response("SKU,Name\n"));
    const movements = await downloadReport("stock-movements", range);
    expect(movements.filename).toBe("stock-movements-2026-10-01_2026-10-30.csv");
  });
});

describe("filename helpers", () => {
  it("parses quoted and RFC 5987 filenames", () => {
    expect(filenameFromContentDisposition('attachment; filename="report.csv"')).toBe("report.csv");
    expect(filenameFromContentDisposition("attachment; filename*=UTF-8''sales%20report.csv")).toBe("sales report.csv");
    expect(filenameFromContentDisposition(null)).toBeNull();
  });

  it("uses today's date for non-range exports", () => {
    expect(fallbackFilename("inventory", range)).toMatch(/^inventory-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(fallbackFilename("low-stock", range)).toMatch(/^low-stock-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
