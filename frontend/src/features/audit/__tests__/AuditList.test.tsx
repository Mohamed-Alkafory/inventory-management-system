import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import AuditList from "../AuditList";

vi.mock("../hooks", () => {
  const log = (userId: string, userName: string, id: string) => ({
    id,
    userId,
    userName,
    action: "user.updated",
    entityType: "user",
    entityId: userId,
    oldValues: { name: "Old" },
    newValues: { name: userName },
    createdAt: "2026-01-02T10:00:00.000Z",
  });

  return {
    useAuditLogs: () => ({
      data: {
        items: [
          log("u-admin", "Amina Admin", "a-1"),
          log("u-staff", "Sami Staff", "a-2"),
          log("u-support", "Sara Support", "a-3"),
          log("u-customer", "Cara Customer", "a-4"),
        ],
        total: 4,
      },
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    }),
  };
});

vi.mock("../../users/hooks", () => {
  const user = (id: string, name: string, role: string) => ({
    id,
    name,
    email: `${id}@prodexa.com`,
    role,
    isActive: true,
    avatarUrl: null,
    createdAt: "2026-01-02T10:00:00.000Z",
  });

  return {
    useUsers: () => ({
      data: {
        items: [
          user("u-admin", "Amina Admin", "ADMIN"),
          user("u-staff", "Sami Staff", "STAFF"),
          user("u-support", "Sara Support", "SUPPORT"),
          user("u-customer", "Cara Customer", "CUSTOMER"),
        ],
        total: 4,
      },
    }),
  };
});

afterEach(cleanup);

describe("AuditList actor roles", () => {
  it("labels every actor option with its role while keeping the existing filters", () => {
    render(
      <MemoryRouter>
        <AuditList />
      </MemoryRouter>,
    );

    const actorSelect = screen.getByLabelText("Filter by user");
    expect(within(actorSelect).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "All users",
      "Amina Admin (Admin)",
      "Sami Staff (Staff)",
      "Sara Support (Support)",
      "Cara Customer (Customer)",
    ]);

    expect(screen.getByLabelText("Filter by entity type")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by action")).toBeInTheDocument();
    expect(screen.getByText("From")).toBeInTheDocument();
    expect(screen.getByText("To")).toBeInTheDocument();
  });

  it("shows a role badge next to each actor name", () => {
    render(
      <MemoryRouter>
        <AuditList />
      </MemoryRouter>,
    );

    const table = screen.getByRole("table");
    for (const label of ["Admin", "Staff", "Support", "Customer"]) {
      expect(within(table).getByText(label)).toBeInTheDocument();
    }
    expect(within(table).getByText("Amina Admin")).toBeInTheDocument();
    expect(within(table).getByText("Cara Customer")).toBeInTheDocument();
  });
});
