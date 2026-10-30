import { useLocation } from "react-router-dom";
import { areaForPath } from "./redirect";
import type { AppArea } from "./redirect";

/** The dashboard shell the current location belongs to, or null on the storefront. */
export function useArea(): AppArea | null {
  return areaForPath(useLocation().pathname);
}
