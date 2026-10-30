import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/http";
import ToastProvider from "../../components/ui/toast/ToastProvider";
import type { User } from "../../types/auth";
import Settings from "./Settings";

const state = vi.hoisted(() => ({
  user: {
    id: "u1",
    name: "Ada Lovelace",
    email: "ada@example.com",
    role: "ADMIN",
  } as User | null,
  updateProfile: vi.fn(),
  deleteAccount: vi.fn(),
}));

vi.mock("../../context/auth/useAuth", () => ({
  useAuth: () => ({
    user: state.user,
    updateProfile: state.updateProfile,
    deleteAccount: state.deleteAccount,
  }),
}));

vi.mock("../../features/notifications/NotificationPreferences", () => ({
  default: () => <div data-testid="notification-preferences">Notification preferences</div>,
}));

function renderSettings() {
  return render(
    <MemoryRouter initialEntries={["/settings"]}>
      <ToastProvider>
        <Routes>
          <Route path="/settings" element={<Settings />} />
          <Route path="/" element={<div>Home page</div>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

const fillPassword = (current: string, next: string, confirm: string) => {
  fireEvent.change(screen.getByLabelText(/^Current password/), { target: { value: current } });
  fireEvent.change(screen.getByLabelText(/^New password/), { target: { value: next } });
  fireEvent.change(screen.getByLabelText(/^Confirm new password/), { target: { value: confirm } });
};

describe("Settings page", () => {
  beforeEach(() => {
    state.user = {
      id: "u1",
      name: "Ada Lovelace",
      email: "ada@example.com",
      role: "ADMIN",
    };
    state.updateProfile.mockReset().mockResolvedValue(state.user);
    state.deleteAccount.mockReset().mockResolvedValue(undefined);
  });

  afterEach(cleanup);

  it("shows the account details and the notification preferences section", () => {
    renderSettings();

    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByText("ADMIN")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Display name/)).toHaveValue("Ada Lovelace");
    expect(screen.getByRole("button", { name: "Save name" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change password" })).toBeInTheDocument();
    expect(screen.getByTestId("notification-preferences")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete account" })).toBeInTheDocument();
  });

  it("saves a new display name", async () => {
    renderSettings();

    fireEvent.change(screen.getByLabelText(/^Display name/), { target: { value: "Ada Byron" } });
    fireEvent.click(screen.getByRole("button", { name: "Save name" }));

    await waitFor(() => expect(state.updateProfile).toHaveBeenCalledWith({ name: "Ada Byron" }));
    expect(await screen.findByText("Settings saved")).toBeInTheDocument();
  });

  it("validates the display name before saving", async () => {
    renderSettings();

    fireEvent.change(screen.getByLabelText(/^Display name/), { target: { value: "A" } });
    fireEvent.click(screen.getByRole("button", { name: "Save name" }));

    expect(await screen.findByText("Name must be at least 2 characters.")).toBeInTheDocument();
    expect(state.updateProfile).not.toHaveBeenCalled();
  });

  it("shows the server error on the display-name field", async () => {
    state.updateProfile.mockRejectedValueOnce(
      new ApiError(409, "Name is taken", { fieldErrors: { name: "This name is already in use." } }),
    );
    renderSettings();

    fireEvent.change(screen.getByLabelText(/^Display name/), { target: { value: "Ada Byron" } });
    fireEvent.click(screen.getByRole("button", { name: "Save name" }));

    expect(await screen.findByText("This name is already in use.")).toBeInTheDocument();
  });

  it("changes the password when the form is valid", async () => {
    renderSettings();

    fillPassword("old-password", "new-password", "new-password");
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));

    await waitFor(() =>
      expect(state.updateProfile).toHaveBeenCalledWith({
        password: { current: "old-password", next: "new-password" },
      }),
    );
    expect(await screen.findByText("Password changed")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Current password/)).toHaveValue("");
  });

  it("rejects a mismatched password confirmation", async () => {
    renderSettings();

    fillPassword("old-password", "new-password", "different-password");
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByText("Passwords don't match.")).toBeInTheDocument();
    expect(state.updateProfile).not.toHaveBeenCalled();
  });

  it("rejects a short new password", async () => {
    renderSettings();

    fillPassword("old-password", "short", "short");
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByText("Password must be at least 8 characters.")).toBeInTheDocument();
    expect(state.updateProfile).not.toHaveBeenCalled();
  });

  it("maps server password errors to the matching field", async () => {
    state.updateProfile.mockRejectedValueOnce(
      new ApiError(422, "Wrong password", { fieldErrors: { current: "Current password is incorrect." } }),
    );
    renderSettings();

    fillPassword("wrong-password", "new-password", "new-password");
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByText("Current password is incorrect.")).toBeInTheDocument();
  });

  it("deletes the account after confirmation", async () => {
    renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete account" }));

    await waitFor(() => expect(state.deleteAccount).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Home page")).toBeInTheDocument();
  });
});