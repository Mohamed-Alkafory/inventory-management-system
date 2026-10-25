import { useEffect, useRef, useState } from "react";

type Options = {
  /** 0–1, how much of the element must be visible. */
  threshold?: number;
  rootMargin?: string;
  /** Stay "in view" after the first time (default). */
  once?: boolean;
};

/**
 * Tells you when an element scrolls into view.
 * Without IntersectionObserver (old browsers, jsdom) it reports `true` straight away,
 * so content is never left hidden.
 */
export function useInView<T extends Element = HTMLDivElement>({
  threshold = 0.15,
  rootMargin = "0px 0px -8% 0px",
  once = true,
}: Options = {}) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return { ref, inView };
}
