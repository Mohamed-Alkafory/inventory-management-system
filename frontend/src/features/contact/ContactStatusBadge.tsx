import { CONTACT_STATUS_LABEL } from "./types";
import type { ContactStatus } from "./types";

const TONE: Record<ContactStatus, string> = {
  NEW: "bg-[#FFEAB6] text-[#B7791F]",
  IN_PROGRESS: "bg-[#E0F2FE] text-[#0369A1]",
  RESOLVED: "bg-[#DDF5EA] text-[#1F8F6B]",
};

export default function ContactStatusBadge({ status }: { status: ContactStatus }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[status]}`}>
      {CONTACT_STATUS_LABEL[status]}
    </span>
  );
}
