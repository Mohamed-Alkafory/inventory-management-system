import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import UserAvatar from "./UserAvatar";

afterEach(() => {
  cleanup();
});

describe("UserAvatar", () => {
  it("renders the resolved avatar image when a URL is present", () => {
    render(<UserAvatar name="Jane Doe" src="/uploads/avatars/jane.webp" />);

    const img = screen.getByRole("img", { name: "Jane Doe avatar" });
    expect(img.tagName).toBe("IMG");
    expect(img).toHaveAttribute("src", "/uploads/avatars/jane.webp");
  });

  it("falls back to initials when there is no avatar", () => {
    render(<UserAvatar name="Jane Doe" src={null} />);

    expect(screen.getByRole("img", { name: "Jane Doe avatar" })).toHaveTextContent("JD");
    expect(screen.queryByRole("img", { name: "Jane Doe avatar" })?.tagName).not.toBe("IMG");
  });

  it("falls back to initials when the image fails to load", () => {
    render(<UserAvatar name="Sami Staff" src="https://cdn.example.com/missing.png" />);

    const img = screen.getByRole("img", { name: "Sami Staff avatar" });
    fireEvent.error(img);

    expect(screen.getByRole("img", { name: "Sami Staff avatar" })).toHaveTextContent("SS");
  });
});
