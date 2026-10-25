import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";
const supported = () => typeof window !== "undefined" && typeof window.matchMedia === "function";

function subscribe(onChange: () => void) {
  if (!supported()) return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

const getSnapshot = () => supported() && window.matchMedia(QUERY).matches;

/** True when the OS asks for less motion — animations should then be skipped. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
