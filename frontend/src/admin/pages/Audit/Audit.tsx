import AuditList from "../../../features/audit/AuditList";

export default function Audit() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold text-[#111827]">Audit Log</h1>
      <p className="mt-1 text-sm text-[#6B7280]">Review who changed what — every admin and system change is recorded here</p>
      <div className="mt-6">
        <AuditList />
      </div>
    </div>
  );
}
