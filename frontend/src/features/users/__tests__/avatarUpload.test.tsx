import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ImageUploadField from "../../products/ImageUploadField";
import { AVATAR_RULES, AVATAR_SIZE_ERROR, AVATAR_TYPE_ERROR, MAX_AVATAR_BYTES } from "../avatar";

beforeEach(() => {
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(() => "blob:avatar-preview"),
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

const pngFile = (size = 16) => new File([new Uint8Array(size)], "avatar.png", { type: "image/png" });

function Harness() {
  const [file, setFile] = useState<File | null>(null);
  return (
    <ImageUploadField
      file={file}
      onFileSelect={setFile}
      onRemove={() => setFile(null)}
      rules={AVATAR_RULES}
      label="Avatar"
      hint="JPEG, PNG or WebP — up to 1 MB."
      previewAlt="Avatar preview"
      previewClassName="size-24 rounded-full"
      helperText={null}
      chooseLabel="Choose avatar"
      changeLabel="Change avatar"
      removeLabel="Remove avatar"
    />
  );
}

const fileInput = () => screen.getByLabelText(/^avatar$/i) as HTMLInputElement;

describe("avatar upload field", () => {
  it("rejects a wrong file type", () => {
    render(<Harness />);

    const gif = new File(["gif"], "anim.gif", { type: "image/gif" });
    fireEvent.change(fileInput(), { target: { files: [gif] } });

    expect(screen.getByRole("alert")).toHaveTextContent(AVATAR_TYPE_ERROR);
    expect(screen.queryByAltText("Avatar preview")).not.toBeInTheDocument();
  });

  it("rejects a file larger than 1 MB", () => {
    render(<Harness />);

    const tooLarge = new File([new Uint8Array(MAX_AVATAR_BYTES + 1)], "big.png", { type: "image/png" });
    fireEvent.change(fileInput(), { target: { files: [tooLarge] } });

    expect(screen.getByRole("alert")).toHaveTextContent(AVATAR_SIZE_ERROR);
    expect(screen.queryByAltText("Avatar preview")).not.toBeInTheDocument();
  });

  it("accepts a valid file and shows a preview", () => {
    render(<Harness />);

    fireEvent.change(fileInput(), { target: { files: [pngFile()] } });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByAltText("Avatar preview")).toHaveAttribute("src", "blob:avatar-preview");
    expect(screen.getByRole("button", { name: /remove avatar/i })).toBeInTheDocument();
  });
});
