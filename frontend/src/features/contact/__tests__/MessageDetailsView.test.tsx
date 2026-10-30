import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "../../../types/auth";
import { ApiError } from "../../../lib/http";
import MessageDetailsView from "../MessageDetailsView";

const mocks = vi.hoisted(() => {
  const mutation = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), reset: vi.fn(), isPending: false, error: null });
  return {
    role: "SUPPORT" as Role | null,
    user: { id: "u-me", name: "Sam Support" },
    useContactMessage: vi.fn(),
    update: mutation(),
  };
});

vi.mock("../hooks", () => ({
  useContactMessage: mocks.useContactMessage,
  useUpdateContactMessage: () => mocks.update,
}));

vi.mock("../../../context/auth/useAuth", () => ({
  useAuth: () => ({ user: mocks.user, role: mocks.role }),
}));

const queryResult = (data: unknown) => ({
  data,
  isPending: false,
  isError: false,
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
  internalNote: "Customer emailed twice.",
  createdAt: "2026-01-01T10:00:00.000Z",
  updatedAt: "2026-01-01T10:00:00.000Z",
  ...overrides,
});

beforeEach(() => {
  mocks.role = "SUPPORT";
  mocks.user = { id: "u-me", name: "Sam Support" };
  mocks.useContactMessage.mockReturnValue(queryResult(message()));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("MessageDetailsView", () => {
  it("shows the full message, status, assignee and internal note", () => {
    render(
      <MemoryRouter>
        <MessageDetailsView id="m-1" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Order arrived damaged" })).toBeInTheDocument();
    expect(screen.getByText("The bottle arrived cracked.")).toBeInTheDocument();
    expect(screen.getByLabelText("Change status")).toHaveValue("NEW");
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
    expect(screen.getByLabelText(/Internal note/)).toHaveValue("Customer emailed twice.");
    expect(screen.getByRole("button", { name: "Assign to me" })).toBeInTheDocument();
  });

  it("changes the status", () => {
    render(
      <MemoryRouter>
        <MessageDetailsView id="m-1" />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Change status"), { target: { value: "IN_PROGRESS" } });
    expect(mocks.update.mutate).toHaveBeenCalledWith({ id: "m-1", patch: { status: "IN_PROGRESS" } });
  });

  it("assigns to the signed-in user without calling /users", () => {
    render(
      <MemoryRouter>
        <MessageDetailsView id="m-1" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Assign to me" }));
    expect(mocks.update.mutate).toHaveBeenCalledWith({ id: "m-1", patch: { assignedToId: "u-me" } });
  });

  it("unassigns a message already assigned to me", () => {
    mocks.useContactMessage.mockReturnValue(
      queryResult(message({ assignedToId: "u-me", assignedTo: { id: "u-me", name: "Sam Support" } })),
    );

    render(
      <MemoryRouter>
        <MessageDetailsView id="m-1" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Unassign" }));
    expect(mocks.update.mutate).toHaveBeenCalledWith({ id: "m-1", patch: { assignedToId: null } });
  });

  it("saves a trimmed internal note and clears an empty one", async () => {
    render(
      <MemoryRouter>
        <MessageDetailsView id="m-1" />
      </MemoryRouter>,
    );

    const note = screen.getByLabelText(/Internal note/);
    fireEvent.change(note, { target: { value: "  Escalated to logistics  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));
    expect(mocks.update.mutate).toHaveBeenCalledWith({ id: "m-1", patch: { internalNote: "Escalated to logistics" } });

    fireEvent.change(note, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));
    expect(mocks.update.mutate).toHaveBeenCalledWith({ id: "m-1", patch: { internalNote: null } });
  });

  it("does not offer triage controls when the role lacks contact.manage", () => {
    mocks.role = "STAFF";

    render(
      <MemoryRouter>
        <MessageDetailsView id="m-1" />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText("Change status")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Assign to me" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save note" })).toBeNull();
  });

  it("handles a missing message gracefully", () => {
    mocks.useContactMessage.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new ApiError(404, "Contact message not found"),
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter>
        <MessageDetailsView id="missing" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Message not found");
  });
});
