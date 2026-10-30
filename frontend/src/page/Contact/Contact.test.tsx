import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "../../types/auth";
import { ApiError } from "../../lib/http";
import Contact from "./Contact";

const submit = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({ user: null as User | null }));

vi.mock("../../features/contact/publicApi", () => ({
  publicContactApi: { submit },
}));

vi.mock("../../context/auth/useAuth", () => ({
  useAuth: () => ({ user: auth.user }),
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Contact />
    </QueryClientProvider>,
  );
}

const submitButton = () => screen.getByRole("button", { name: /send inquiry/i });

function fillForm(overrides: Partial<Record<"name" | "email" | "subject" | "message", string>> = {}) {
  fireEvent.change(screen.getByLabelText(/full name/i), {
    target: { value: overrides.name ?? "Jane Doe" },
  });
  fireEvent.change(screen.getByLabelText(/work email/i), {
    target: { value: overrides.email ?? "jane@example.com" },
  });
  fireEvent.change(screen.getByLabelText(/subject/i), {
    target: { value: overrides.subject ?? "Damaged order" },
  });
  fireEvent.change(screen.getByLabelText(/your message/i), {
    target: { value: overrides.message ?? "Please help with my order." },
  });
}

beforeEach(() => {
  auth.user = null;
  submit.mockReset();
  submit.mockResolvedValue({ received: true });
});

afterEach(cleanup);

describe("Contact page", () => {
  it("enforces the backend limits before submitting", async () => {
    renderPage();

    fireEvent.click(submitButton());

    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(screen.getByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText("Subject is required")).toBeInTheDocument();
    expect(screen.getByText("Message is required")).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();

    fillForm({
      name: "a".repeat(101),
      email: "not-an-email",
      subject: "b".repeat(201),
      message: "c".repeat(5001),
    });
    fireEvent.click(submitButton());

    expect(await screen.findByText("Name must be 100 characters or fewer")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
    expect(screen.getByText("Subject must be 200 characters or fewer")).toBeInTheDocument();
    expect(screen.getByText("Message must be 5,000 characters or fewer")).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });

  it("starts with an empty, off-screen honeypot", () => {
    const { container } = renderPage();
    const honeypot = container.querySelector('input[name="honeypot"]') as HTMLInputElement;

    expect(honeypot).toHaveValue("");
    expect(honeypot).toHaveAttribute("tabindex", "-1");
    expect(honeypot).toHaveAttribute("autocomplete", "off");
    expect(honeypot.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("submits exactly the documented payload and offers to send another", async () => {
    renderPage();
    fillForm();

    fireEvent.click(submitButton());

    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith({
        name: "Jane Doe",
        email: "jane@example.com",
        subject: "Damaged order",
        message: "Please help with my order.",
        honeypot: "",
      }),
    );
    expect(submit).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("heading", { name: /message sent/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /send another message/i }));

    expect(await screen.findByRole("button", { name: /send inquiry/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toHaveValue("");
    expect(screen.getByLabelText(/work email/i)).toHaveValue("");
  });

  it("prefills name and email for signed-in users", () => {
    auth.user = {
      id: "4",
      name: "Cara Customer",
      email: "customer@prodexa.com",
      role: "CUSTOMER",
    };
    renderPage();

    expect(screen.getByLabelText(/full name/i)).toHaveValue("Cara Customer");
    expect(screen.getByLabelText(/work email/i)).toHaveValue("customer@prodexa.com");
  });

  it("explains the rate limit on 429", async () => {
    submit.mockRejectedValue(new ApiError(429, "ThrottlerException: Too Many Requests"));
    renderPage();
    fillForm();

    fireEvent.click(submitButton());

    expect(
      await screen.findByText(/too many messages from this device\. please try again later\./i),
    ).toBeInTheDocument();
  });

  it("shows the network error without losing the form", async () => {
    submit.mockRejectedValue(
      new ApiError(0, "Can’t reach the server. Check your connection and try again."),
    );
    renderPage();
    fillForm();

    fireEvent.click(submitButton());

    expect(await screen.findByText(/reach the server/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toHaveValue("Jane Doe");
  });

  it("disables the button while a submission is in flight", async () => {
    let resolve: (value: { received: true }) => void = () => {};
    submit.mockReturnValue(
      new Promise<{ received: true }>((r) => {
        resolve = r;
      }),
    );
    renderPage();
    fillForm();

    const button = submitButton();
    fireEvent.click(button);

    await waitFor(() => expect(button).toBeDisabled());
    fireEvent.click(button);
    expect(submit).toHaveBeenCalledTimes(1);

    resolve({ received: true });
    expect(await screen.findByRole("heading", { name: /message sent/i })).toBeInTheDocument();
  });
});
