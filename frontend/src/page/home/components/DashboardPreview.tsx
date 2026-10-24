import { Card } from "../../../components/ui/Card";
import StatusBadge from "../../../components/ui/StatusBadge";
import type { Status } from "../../../components/ui/StatusBadge";

const TILES = [
  { label: "Products", value: "1,248", note: "+12 this week" },
  { label: "Low stock", value: "18", note: "Needs reorder" },
  { label: "Open orders", value: "64", note: "12 shipping today" },
];

const ROWS: { name: string; sku: string; stock: number; status: Status }[] = [
  { name: "Wireless Mouse", sku: "WM-204", stock: 142, status: "in_stock" },
  { name: "USB-C Charging Cable", sku: "UC-110", stock: 9, status: "low_stock" },
  { name: "Laptop Stand", sku: "LS-031", stock: 0, status: "out_of_stock" },
  { name: "Desk Lamp", sku: "DL-090", stock: 57, status: "in_stock" },
];

const BARS = [45, 62, 38, 74, 55, 88, 68];

/** Decorative, static mock-up of the product dashboard. */
export default function DashboardPreview() {
  return (
    <div
      role="img"
      aria-label="Preview of the dashboard showing products, low-stock alerts and open orders"
      className="relative"
    >
      <div className="pointer-events-none absolute -right-6 -top-8 h-48 w-48 rounded-full bg-[#FDBA8C]/40 blur-3xl" />

      <Card className="relative overflow-hidden rounded-3xl border-[#FDECDC] shadow-xl shadow-[#7A3410]/10">
        <div className="flex items-center gap-2 border-b border-line px-5 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FDBA8C]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#FDECDC]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#F0F1F3]" />
          <span className="ml-3 text-xs font-semibold text-muted">Inventory overview</span>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-3 gap-3">
            {TILES.map((t) => (
              <div key={t.label} className="rounded-xl border border-[#FDECDC] bg-[#FEF9F5] p-3">
                <p className="text-[11px] font-medium text-muted">{t.label}</p>
                <p className="mt-1 text-xl font-bold text-ink">{t.value}</p>
                <p className="mt-0.5 text-[10px] text-primary-600">{t.note}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-line p-3">
            <p className="text-[11px] font-medium text-muted">Stock movement · last 7 days</p>
            <div className="mt-3 flex h-16 items-end gap-2">
              {BARS.map((h, i) => (
                <div
                  key={i}
                  style={{ height: `${h}%` }}
                  className={`flex-1 rounded-t-md ${i === 5 ? "bg-primary-500" : "bg-[#FDECDC]"}`}
                />
              ))}
            </div>
          </div>

          <ul className="divide-y divide-line rounded-xl border border-line">
            {ROWS.map((r) => (
              <li key={r.sku} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{r.name}</p>
                  <p className="text-[11px] text-muted">
                    {r.sku} · {r.stock} units
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <div className="absolute -bottom-5 -left-3 hidden items-center gap-2 rounded-2xl border border-line bg-white px-4 py-3 shadow-lg shadow-[#7A3410]/10 sm:flex">
        <div>
          <p className="text-[11px] font-medium text-muted">Order #1042</p>
          <p className="text-sm font-semibold text-ink">Left the warehouse</p>
        </div>
        <StatusBadge status="shipped" />
      </div>
    </div>
  );
}
