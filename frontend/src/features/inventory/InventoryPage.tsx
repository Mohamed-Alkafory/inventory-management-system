import { useState } from "react";
import { USE_MOCK } from "./api";
import MovementsPanel from "./MovementsPanel";
import StockLevels from "./StockLevels";

type Tab = "stock" | "history";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "stock", label: "Stock levels" },
  { id: "history", label: "Movement history" },
];

/**
 * Shared inventory page used by /admin/inventory and /staff/inventory.
 * Actions inside the panels are role-gated through `can()`.
 */
export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>("stock");

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-[#111827]">Inventory</h1>
      <p className="mt-1 text-sm text-[#6B7280]">Track stock levels and manage inventory</p>
      {USE_MOCK && (
        <p className="mt-2 inline-block rounded-full bg-[#FFF1EB] px-2.5 py-1 text-[11px] font-semibold text-[#FF5615]">
          Demo data (mock API)
        </p>
      )}

      <div role="tablist" aria-label="Inventory views" className="mt-6 flex gap-1 border-b border-[#E5E7EB]">
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5615] ${
              tab === t.id
                ? "border-[#FF5615] text-[#FF5615]"
                : "border-transparent text-[#6B7280] hover:text-[#111827]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="mt-5">
        {tab === "stock" ? <StockLevels /> : <MovementsPanel />}
      </div>
    </div>
  );
}
