import Modal from "../../components/ui/Modal";
import { humanizeEntityType } from "./status";
import type { AuditLog } from "./types";

/** Short, readable value: primitives as-is, arrays/objects as compact JSON. */
function preview(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Side-by-side "Before / After" for one audit row. Keys come from the
 * union of old + new values; differing keys are highlighted. A creation
 * shows an empty "Before" column, deactivations often mirror the row.
 */
export default function AuditRowDetails({ log, onClose }: { log: AuditLog; onClose: () => void }) {
  const before = log.oldValues ?? {};
  const after = log.newValues ?? {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();

  return (
    <Modal open onClose={onClose} title="What changed" size="lg" description={`${humanizeEntityType(log.entityType)} · ${log.action}`} footer={<></>}>
      {keys.length === 0 ? (
        <p className="text-sm text-[#6B7280]">No stored values on this entry (payload may have been empty).</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-[13px]">
            <thead>
              <tr>
                <th className="w-28 border-b border-[#F3F4F6] py-2 pr-3 text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Field</th>
                <th className="border-b border-[#F3F4F6] py-2 pr-3 text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Before</th>
                <th className="border-b border-[#F3F4F6] py-2 text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">After</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {keys.map((key) => {
                const oldV = key in before ? before[key] : undefined;
                const newV = key in after ? after[key] : undefined;
                const changed = preview(oldV) !== preview(newV);
                return (
                  <tr key={key}>
                    <td className="py-2 pr-3 font-medium text-[#6B7280]">{key}</td>
                    <td className={`py-2 pr-3 text-[#374151] ${changed ? "bg-[#FEF2F2]" : ""}`}>{preview(oldV)}</td>
                    <td className={`py-2 text-[#111827] ${changed ? "bg-[#FFF7ED]" : ""}`}>{preview(newV)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
