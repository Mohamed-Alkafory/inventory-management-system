import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

type Options = {
  /** Begin animating (e.g. when the number scrolls into view). */
  start?: boolean;
  duration?: number;
};

/**
 * Eases a number toward `target`. When `target` changes it continues from the
 * current value instead of restarting from zero. Skipped for reduced motion.
 */
export function useCountUp(target: number, { start = true, duration = 1400 }: Options = {}): number {
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    if (!start || reduced) return;

    const from = current.current;
    const t0 = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      current.current = from + (target - from) * eased;
      setValue(current.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [start, reduced, target, duration]);

  return reduced ? target : value;
}
