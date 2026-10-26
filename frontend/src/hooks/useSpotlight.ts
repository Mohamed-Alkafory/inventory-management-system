import type { PointerEvent } from "react";

/**
 * onPointerMove handler that publishes the cursor position as --mx / --my on the element.
 * Pair it with a CSS radial-gradient that reads those variables to get a "follow the cursor" glow.
 */
export function spotlightHandler(e: PointerEvent<HTMLElement>) {
  if (e.pointerType !== "mouse") return;
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
  el.style.setProperty("--my", `${e.clientY - rect.top}px`);
}
