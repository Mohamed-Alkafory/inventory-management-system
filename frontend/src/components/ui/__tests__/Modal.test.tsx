import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConfirmDialog from "../ConfirmDialog";
import Modal from "../Modal";

afterEach(cleanup);

describe("Modal", () => {
  it("renders nothing when closed", () => {
    render(<Modal open={false} onClose={() => {}} title="Hello" />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is a labelled dialog that closes on Escape and on the close button", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Edit product">
        <p>Body</p>
      </Modal>,
    );

    expect(screen.getByRole("dialog", { name: "Edit product" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("cannot be dismissed when dismissible is false", () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="Saving" dismissible={false} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });
});

describe("ConfirmDialog", () => {
  it("calls onConfirm and onCancel", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Delete product?"
        confirmLabel="Delete"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("locks both buttons while loading", () => {
    render(
      <ConfirmDialog open loading title="Delete?" confirmLabel="Delete" onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });
});
