import Badge, { type BadgeTone } from "../../components/ui/Badge";
import { ROLE_LABELS } from "../../types/auth";
import type { UserRole } from "./types";

const ROLE_TONE: Record<UserRole, BadgeTone> = {
  ADMIN: "primary",
  STAFF: "info",
  SUPPORT: "warning",
  CUSTOMER: "neutral",
};

/** Coloured pill for every backend role. */
export default function RoleBadge({ role }: { role: UserRole }) {
  return <Badge tone={ROLE_TONE[role]}>{ROLE_LABELS[role]}</Badge>;
}

/** Active / deactivated pill (reuse of the tone ramp). */
export function AccountStatusChip({ isActive }: { isActive: boolean }) {
  return <Badge tone={isActive ? "success" : "danger"} dot>{isActive ? "Active" : "Deactivated"}</Badge>;
}
