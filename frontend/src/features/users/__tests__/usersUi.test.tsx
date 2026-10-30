import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ToastProvider from "../../../components/ui/toast/ToastProvider";
import { ApiError } from "../../../lib/http";
import { ROLES } from "../../../types/auth";
import UserFormDialog from "../UserFormDialog";
import UsersList from "../UsersList";
import type { AdminUser } from "../types";

const updateMutate = vi.hoisted(() => vi.fn());
const createMutate = vi.hoisted(() => vi.fn());

vi.mock("../hooks", () => ({
  useUsers: () => ({
    data: { items: [], total: 0 },
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
  useCreateUser: () => ({ isPending: false, mutateAsync: createMutate }),
  useUpdateUser: () => ({ isPending: false, mutateAsync: updateMutate }),
  useDeactivateUser: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

vi.mock("../../../context/auth/useAuth", () => ({
  useAuth: () => ({
    user: { id: "me", name: "Admin", email: "admin@prodexa.com", role: "ADMIN" },
    isAuthenticated: true,
    role: "ADMIN",
  }),
}));

const supportUser: AdminUser = {
  id: "u1",
  name: "Sara Support",
  email: "sara@prodexa.com",
  role: "SUPPORT",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const adminUser: AdminUser = {
  ...supportUser,
  id: "me",
  name: "Admin",
  email: "admin@prodexa.com",
  role: "ADMIN",
};

beforeEach(() => {
  updateMutate.mockReset();
  updateMutate.mockResolvedValue(supportUser);
  createMutate.mockReset();
  createMutate.mockResolvedValue(supportUser);
});
afterEach(cleanup);

describe("UsersList role filter", () => {
  it("offers all four roles plus All roles", () => {
    render(
      <ToastProvider>
        <UsersList />
      </ToastProvider>,
    );

    const select = screen.getByLabelText("Filter by role");
    const options = within(select).getAllByRole("option");
    expect(options).toHaveLength(ROLES.length + 1);
    expect(options.map((o) => o.textContent)).toEqual(["All roles", "Admin", "Staff", "Support", "Customer"]);
  });

  it("shows all four roles in the create form", () => {
    render(
      <ToastProvider>
        <UsersList />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /new user/i }));

    const dialog = screen.getByRole("dialog");
    for (const label of ["Admin", "Staff", "Support", "Customer"]) {
      expect(within(dialog).getByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
    }
  });
});

describe("UserFormDialog role handling", () => {
  it.each([
    ["ADMIN", "Admin"],
    ["STAFF", "Staff"],
    ["SUPPORT", "Support"],
    ["CUSTOMER", "Customer"],
  ] as const)("creates a %s user with the selected role", async (role, label) => {
    const onClose = vi.fn();
    render(
      <ToastProvider>
        <UserFormDialog user={null} onClose={onClose} />
      </ToastProvider>,
    );

    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/full name/i), { target: { value: "New Person" } });
    fireEvent.change(within(dialog).getByLabelText(/email/i), { target: { value: "new@prodexa.com" } });
    fireEvent.change(within(dialog).getByLabelText(/initial password/i), { target: { value: "Password123" } });
    fireEvent.click(within(dialog).getByRole("button", { name: new RegExp(`^${label}`) }));
    fireEvent.click(within(dialog).getByRole("button", { name: /create user/i }));

    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    expect(createMutate).toHaveBeenCalledWith({
      name: "New Person",
      email: "new@prodexa.com",
      password: "Password123",
      role,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("does not send a role when the admin did not change it", async () => {
    const onClose = vi.fn();
    render(
      <ToastProvider>
        <UserFormDialog user={supportUser} onClose={onClose} />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    expect(updateMutate.mock.calls[0][0]).toEqual({
      id: "u1",
      patch: { name: "Sara Support", email: "sara@prodexa.com" },
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("sends the new role only when the admin selects one", async () => {
    const onClose = vi.fn();
    render(
      <ToastProvider>
        <UserFormDialog user={supportUser} onClose={onClose} />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /admin/i }));
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    expect(updateMutate.mock.calls[0][0]).toEqual({
      id: "u1",
      patch: { name: "Sara Support", email: "sara@prodexa.com", role: "ADMIN" },
    });
  });

  it("shows the server message when the last active admin cannot be demoted (409)", async () => {
    updateMutate.mockRejectedValue(
      new ApiError(409, "At least one active ADMIN must remain", {
        serverMessage: "At least one active ADMIN must remain",
      }),
    );
    const onClose = vi.fn();
    render(
      <ToastProvider>
        <UserFormDialog user={adminUser} onClose={onClose} />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Customer/ }));
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("At least one active ADMIN must remain");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows the self-protection message when an admin changes their own role (422)", async () => {
    updateMutate.mockRejectedValue(
      new ApiError(422, "Admins cannot change their own role", {
        serverMessage: "Admins cannot change their own role",
      }),
    );
    const onClose = vi.fn();
    render(
      <ToastProvider>
        <UserFormDialog user={adminUser} onClose={onClose} />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Staff/ }));
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Admins cannot change their own role");
    expect(onClose).not.toHaveBeenCalled();
  });
});
