import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ImageUploadField from "../ImageUploadField";
import { IMAGE_SIZE_ERROR, IMAGE_TYPE_ERROR, MAX_IMAGE_BYTES } from "../imageFile";

beforeEach(() => {
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(() => "blob:preview"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
});

const pngFile = (size = 16) => new File([new Uint8Array(size)], "photo.png", { type: "image/png" });

/** Controlled wrapper: the selected file is stored the same way ProductForm does. */
function Harness({ currentUrl, onFileSelect }: { currentUrl?: string | null; onFileSelect?: (file: File) => void }) {
  const [file, setFile] = useState<File | null>(null);
  return (
    <ImageUploadField
      currentUrl={currentUrl}
      file={file}
      onFileSelect={(next) => {
        setFile(next);
        if (next) onFileSelect?.(next);
      }}
      onRemove={() => setFile(null)}
    />
  );
}

const fileInput = () => screen.getByLabelText(/product image/i) as HTMLInputElement;

describe("ImageUploadField", () => {
  it("rejects a wrong file type with a clear message", () => {
    const onFileSelect = vi.fn();
    render(<ImageUploadField file={null} onFileSelect={onFileSelect} onRemove={vi.fn()} />);

    const gif = new File(["gif"], "anim.gif", { type: "image/gif" });
    fireEvent.change(fileInput(), { target: { files: [gif] } });

    expect(screen.getByRole("alert")).toHaveTextContent(IMAGE_TYPE_ERROR);
    expect(onFileSelect).not.toHaveBeenCalled();
  });

  it("rejects a file larger than 2 MB", () => {
    const onFileSelect = vi.fn();
    render(<ImageUploadField file={null} onFileSelect={onFileSelect} onRemove={vi.fn()} />);

    const tooLarge = new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], "big.png", { type: "image/png" });
    fireEvent.change(fileInput(), { target: { files: [tooLarge] } });

    expect(screen.getByRole("alert")).toHaveTextContent(IMAGE_SIZE_ERROR);
    expect(onFileSelect).not.toHaveBeenCalled();
  });

  it("accepts a valid file and shows a preview of the selection", () => {
    render(<Harness />);

    const valid = pngFile();
    fireEvent.change(fileInput(), { target: { files: [valid] } });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByAltText("Product image preview")).toHaveAttribute("src", "blob:preview");
    expect(screen.getByRole("button", { name: /remove image/i })).toBeInTheDocument();
  });

  it("shows the current image and removes it on request", () => {
    const onRemove = vi.fn();
    render(
      <ImageUploadField currentUrl="/uploads/products/saved.png" file={null} onRemove={onRemove} onFileSelect={vi.fn()} />,
    );

    expect(screen.getByAltText("Product image preview")).toHaveAttribute("src", "/uploads/products/saved.png");

    fireEvent.click(screen.getByRole("button", { name: /remove image/i }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("hides the saved image once it is marked as removed", () => {
    render(
      <ImageUploadField
        currentUrl="/uploads/products/saved.png"
        file={null}
        removed
        onRemove={vi.fn()}
        onFileSelect={vi.fn()}
      />,
    );

    expect(screen.queryByAltText("Product image preview")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove image/i })).not.toBeInTheDocument();
  });
});
