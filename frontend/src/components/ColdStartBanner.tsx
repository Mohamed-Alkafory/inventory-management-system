import { useSyncExternalStore } from "react";
import {
  getSlowRequestState,
  subscribeSlowRequests,
} from "../lib/coldStart";
import Spinner from "./ui/Spinner";

/**
 * Non-blocking notice shown when the API is slow or a retry is under way
 * (the free backend sleeps after inactivity and needs up to a minute to wake).
 *
 * Rendered once in `App`; it sits above the page and never intercepts clicks.
 */
export default function ColdStartBanner() {
  const { waking } = useSyncExternalStore(
    subscribeSlowRequests,
    getSlowRequestState,
    getSlowRequestState,
  );

  if (!waking) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex items-center gap-2 rounded-card border border-warning-600/30 bg-warning-50 px-4 py-2 text-sm font-medium text-warning-700 shadow-card"
      >
        <Spinner className="text-warning-600" />
        <span>Waking up the server — this can take up to a minute…</span>
      </div>
    </div>
  );
}
