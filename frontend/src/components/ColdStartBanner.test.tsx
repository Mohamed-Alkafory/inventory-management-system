import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SLOW_REQUEST_THRESHOLD_MS, beginApiRequest, resetColdStart } from "../lib/coldStart";
import ColdStartBanner from "./ColdStartBanner";

const apiUrl = () => `${window.location.origin}/api/v1/products`;

beforeEach(() => {
  vi.useFakeTimers();
  resetColdStart();
});

afterEach(() => {
  cleanup();
  resetColdStart();
  vi.useRealTimers();
});

describe("ColdStartBanner", () => {
  it("stays hidden while requests are fast", async () => {
    render(<ColdStartBanner />);
    const end = beginApiRequest(apiUrl());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SLOW_REQUEST_THRESHOLD_MS - 1);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    end();
  });

  it("appears after 3 seconds and disappears when the request settles", async () => {
    render(<ColdStartBanner />);
    const end = beginApiRequest(apiUrl());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SLOW_REQUEST_THRESHOLD_MS);
    });

    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent(/waking up the server/i);
    expect(banner).toHaveAttribute("aria-live", "polite");

    act(() => end());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("is not rendered for external requests", async () => {
    render(<ColdStartBanner />);
    const end = beginApiRequest("https://example.com/slow-data");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SLOW_REQUEST_THRESHOLD_MS * 2);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    end();
  });
});
