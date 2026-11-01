import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Resets the scroll position to the top before the browser paints a new route.
 *
 * React Router keeps the previous scroll offset by default. Because the header
 * is sticky, navigating while scrolled down would briefly paint the new page at
 * the old offset — showing the sticky header (and the footer if it happens to be
 * in view) before jumping to the top. A layout effect runs before paint, so the
 * reset is never visible.
 *
 * Setting `history.scrollRestoration = "manual"` also stops the browser from
 * restoring the old offset on back/forward navigation.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useLayoutEffect(() => {
    // Direct scroll-position reset: works in browsers and stays quiet in jsdom
    // (which implements `scrollTo` as a "not implemented" stub).
    const scroller = document.scrollingElement ?? document.documentElement;
    if (scroller) scroller.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);

  return null;
}
