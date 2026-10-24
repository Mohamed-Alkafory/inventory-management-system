import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ToastProvider from "../toast/ToastProvider";
import { useToast } from "../toast/useToast";

afterEach(cleanup);

function Trigger() {
  const toast = useToast();
  return (
    <>
      <button onClick={() => toast.success("Saved", "Product updated")}>ok</button>
      <button onClick={() => toast.error("Failed")}>fail</button>
    </>
  );
}

describe("Toast", () => {
  it("shows and dismisses a toast", () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText("ok"));
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    expect(screen.getByText("Product updated")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    expect(screen.queryByText("Saved")).toBeNull();
  });

  it("announces errors as alerts", () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText("fail"));
    expect(screen.getByRole("alert")).toHaveTextContent("Failed");
  });
});
