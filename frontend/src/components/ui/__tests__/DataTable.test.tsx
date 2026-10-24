import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DataTable from "../data-table/DataTable";
import type { DataTableColumn } from "../data-table/DataTable";
import { getPageRange } from "../data-table/page-range";

afterEach(cleanup);

type Row = { id: number; name: string };

const columns: DataTableColumn<Row>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "id", header: "ID", enableSorting: false },
];

const bodyRows = () => screen.getAllByRole("row").slice(1);

describe("DataTable", () => {
  it("renders rows and row actions", () => {
    const onDelete = vi.fn();
    render(
      <DataTable
        caption="Products"
        columns={columns}
        data={[{ id: 1, name: "Apple" }]}
        rowActions={(row) => (
          <button onClick={() => onDelete(row.id)}>Delete {row.name}</button>
        )}
      />,
    );

    expect(screen.getByRole("table", { name: "Products" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete Apple" }));
    expect(onDelete).toHaveBeenCalledWith(1);
  });

  it("sorts when a sortable header is clicked", () => {
    render(
      <DataTable
        columns={columns}
        data={[
          { id: 1, name: "Banana" },
          { id: 2, name: "Apple" },
          { id: 3, name: "Cherry" },
        ]}
      />,
    );

    expect(bodyRows()[0]).toHaveTextContent("Banana");

    fireEvent.click(screen.getByRole("button", { name: /name/i }));
    expect(bodyRows()[0]).toHaveTextContent("Apple");
    expect(screen.getByRole("columnheader", { name: /name/i })).toHaveAttribute("aria-sort", "ascending");

    fireEvent.click(screen.getByRole("button", { name: /name/i }));
    expect(bodyRows()[0]).toHaveTextContent("Cherry");
  });

  it("paginates on the client", () => {
    const data = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      name: `Item ${String(i + 1).padStart(2, "0")}`,
    }));
    render(<DataTable columns={columns} data={data} pageSize={10} />);

    expect(bodyRows()).toHaveLength(10);
    expect(screen.getByText("Item 01")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Item 11")).toBeInTheDocument();
    expect(screen.queryByText("Item 01")).toBeNull();

    fireEvent.change(screen.getByLabelText("Rows per page"), { target: { value: "20" } });
    expect(bodyRows()).toHaveLength(20);
  });

  it("shows the empty state", () => {
    render(<DataTable columns={columns} data={[]} emptyTitle="No products" />);
    expect(screen.getByText("No products")).toBeInTheDocument();
  });

  it("shows the error state with retry", () => {
    const onRetry = vi.fn();
    render(<DataTable columns={columns} data={[]} error="Network down" onRetry={onRetry} />);

    const alert = screen.getByRole("alert");
    expect(within(alert).getByText("Network down")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("hides rows while loading", () => {
    render(<DataTable columns={columns} data={[{ id: 1, name: "Apple" }]} loading />);
    expect(screen.queryByText("Apple")).toBeNull();
  });
});

describe("getPageRange", () => {
  it("lists every page for short ranges", () => {
    expect(getPageRange(1, 4)).toEqual([1, 2, 3, 4]);
  });

  it("collapses the middle for long ranges", () => {
    expect(getPageRange(1, 10)).toEqual([1, 2, 3, 4, "ellipsis-end", 10]);
    expect(getPageRange(5, 10)).toEqual([1, "ellipsis-start", 4, 5, 6, "ellipsis-end", 10]);
    expect(getPageRange(10, 10)).toEqual([1, "ellipsis-start", 7, 8, 9, 10]);
  });
});
