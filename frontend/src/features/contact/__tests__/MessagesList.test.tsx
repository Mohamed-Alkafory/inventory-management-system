import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MessagesList from "../MessagesList";

const mocks = vi.hoisted(() => ({
  useContactMessages: vi.fn(),
  userId: "u-me" as string | undefined,
}));

vi.mock("../hooks", () => ({
  useContactMessages: mocks.useContactMessages,
}));

vi.mock("../../../context/auth/useAuth", () => ({
  useAuth: () => ({ user: mocks.userId ? { id: mocks.userId } : null }),
}));

const queryResult = (items: unknown[], total = items.length) => ({
  data: { items, total },
  isPending: false,
  isError: false,
  isFetching: false,
  refetch: vi.fn(),
});

const message = (overrides: Record<string, unknown> = {}) => ({
  id: "m-1",
  name: "Jane Doe",
  email: "jane@example.com",
  subject: "Order arrived damaged",
  message: "The bottle arrived cracked.",
  status: "NEW",
  assignedToId: null,
  assignedTo: null,
  internalNote: null,
  createdAt: "2026-01-01T10:00:00.000Z",
  updatedAt: "2026-01-01T10:00:00.000Z",
  ...overrides,
});

const lastParams = () => mocks.useContactMessages.mock.calls.at(-1)?.[0];

beforeEach(() => {
  mocks.userId = "u-me";
  mocks.useContactMessages.mockReturnValue(queryResult([message()]));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("MessagesList", () => {
  it("renders sender, subject, status, assignee and date", () => {
    render(
      <MemoryRouter>
        <MessagesList />
      </MemoryRouter>,
    );

    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Order arrived damaged" })).toHaveAttribute("href", "/support/messages/m-1");
    expect(within(screen.getByRole("table")).getByText("New")).toBeInTheDocument();
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  it("sends status and assigned-to-me filters to the list endpoint", () => {
    render(
      <MemoryRouter>
        <MessagesList />
      </MemoryRouter>,
    );

    expect(lastParams()).toMatchObject({ status: "", assignedToId: "" });

    fireEvent.change(screen.getByLabelText("Filter by status"), { target: { value: "RESOLVED" } });
    expect(lastParams()).toMatchObject({ status: "RESOLVED" });

    fireEvent.click(screen.getByLabelText("Assigned to me"));
    expect(lastParams()).toMatchObject({ assignedToId: "u-me" });
  });

  it("debounces the search and clears every filter", async () => {
    render(
      <MemoryRouter>
        <MessagesList />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Search messages"), { target: { value: "jane" } });
    fireEvent.change(screen.getByLabelText("Filter by status"), { target: { value: "NEW" } });
    await waitFor(() => expect(lastParams()).toMatchObject({ search: "jane", status: "NEW" }));

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(lastParams()).toMatchObject({ search: "", status: "", assignedToId: "" }));
  });

  it("paginates with the list endpoint and shows the assignee", () => {
    mocks.useContactMessages.mockReturnValue(queryResult([message({ assignedTo: { id: "u-2", name: "Sam Support" } })], 25));

    render(
      <MemoryRouter>
        <MessagesList />
      </MemoryRouter>,
    );

    expect(screen.getByText("Sam Support")).toBeInTheDocument();
    expect(screen.getByText(/Showing 1–10 of 25/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(lastParams()).toMatchObject({ page: 2, pageSize: 10 });
  });
});
