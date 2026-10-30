import { useState } from "react";
import { Play, RotateCcw } from "lucide-react";
import CountUp from "../../../components/motion/CountUp";
import TiltCard from "../../../components/motion/TiltCard";
import Button from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import StatusBadge from "../../../components/ui/StatusBadge";
import type { StockStatus } from "../../../components/ui/StatusBadge";
import { useInView } from "../../../hooks/useInView";
import { cn } from "../../../lib/cn";

type Row = { name: string; sku: string; stock: number; status: StockStatus };

const LOW_AT = 10;
const statusFor = (stock: number): StockStatus => (stock <= 0 ? "out_of_stock" : stock <= LOW_AT ? "low_stock" : "in_stock");

const INITIAL_ROWS: Row[] = [
  { name: "Wireless Mouse", sku: "WM-204", stock: 142, status: "in_stock" },
  { name: "USB-C Charging Cable", sku: "UC-110", stock: 9, status: "low_stock" },
  { name: "Laptop Stand", sku: "LS-031", stock: 0, status: "out_of_stock" },
  { name: "Desk Lamp", sku: "DL-090", stock: 57, status: "in_stock" },
];

const INITIAL_BARS = [45, 62, 38, 74, 55, 88, 68];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SALE_QTYS = [35, 4, 22, 6, 12];

/**
 * Interactive mock-up of the product dashboard: numbers count up, bars grow in and can be
 * inspected, and "Simulate sale" updates stock, status badges, orders and the chart live.
 */
export default function DashboardPreview() {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.25 });
  const [rows, setRows] = useState<Row[]>(INITIAL_ROWS);
  const [bars, setBars] = useState<number[]>(INITIAL_BARS);
  const [sales, setSales] = useState(0);
  const [active, setActive] = useState(5);
  const [flashSku, setFlashSku] = useState<string | null>(null);

  const attention = rows.filter((r) => r.status !== "in_stock").length;

  const simulateSale = () => {
    const candidates = rows.filter((r) => r.stock > 0);
    if (candidates.length === 0) return;

    const target = candidates[sales % candidates.length];
    const qty = Math.min(target.stock, SALE_QTYS[sales % SALE_QTYS.length]);

    setRows((current) =>
      current.map((r) => (r.sku === target.sku ? { ...r, stock: r.stock - qty, status: statusFor(r.stock - qty) } : r)),
    );
    setBars((current) => current.map((h, i) => (i === current.length - 1 ? Math.min(100, h + Math.max(4, Math.round(qty / 2))) : h)));
    setActive(INITIAL_BARS.length - 1);
    setFlashSku(`${target.sku}-${sales}`);
    setSales((n) => n + 1);
  };

  const reset = () => {
    setRows(INITIAL_ROWS);
    setBars(INITIAL_BARS);
    setSales(0);
    setActive(5);
    setFlashSku(null);
  };

  const tiles = [
    { label: "Products", value: 1248 + sales, note: sales ? `+${12 + sales} this week` : "+12 this week" },
    { label: "Low stock", value: 16 + attention, note: "Needs reorder" },
    { label: "Open orders", value: 64 + sales, note: sales ? `${sales} new just now` : "12 shipping today" },
  ];

  const chip =
    sales === 0
      ? { id: 1042, text: "Left the warehouse", status: "CONFIRMED" as const }
      : { id: 1042 + sales, text: "New order just placed", status: "PENDING" as const };

  return (
    <div
      ref={ref}
      role="group"
      aria-label="Interactive preview of the dashboard showing products, low-stock alerts and open orders"
      className="relative"
    >
      <div className="pointer-events-none absolute -right-6 -top-8 h-48 w-48 animate-blob rounded-full bg-[#FDBA8C]/40 blur-3xl motion-reduce:animate-none" />

      <TiltCard>
        <Card className="relative overflow-hidden rounded-3xl border-[#FDECDC] shadow-xl shadow-[#7A3410]/10">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-[#FDBA8C]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#FDECDC]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#F0F1F3]" />
            <span className="ml-3 hidden text-xs font-semibold text-muted sm:inline">Inventory overview</span>

            <div className="ml-auto flex items-center gap-2">
              {sales > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={reset}
                  leftIcon={<RotateCcw className="h-3 w-3" aria-hidden="true" />}
                >
                  Reset
                </Button>
              )}
              <Button
                size="sm"
                onClick={simulateSale}
                leftIcon={<Play className="h-3 w-3" aria-hidden="true" />}
              >
                Simulate sale
              </Button>
            </div>
          </div>

          <div className="space-y-4 p-5">
            <div className="grid grid-cols-3 gap-3">
              {tiles.map((t) => (
                <div
                  key={t.label}
                  className="rounded-xl border border-[#FDECDC] bg-[#FEF9F5] p-3 transition hover:-translate-y-0.5 hover:shadow-sm motion-reduce:transition-none"
                >
                  <p className="text-[11px] font-medium text-muted">{t.label}</p>
                  <p className="mt-1 text-xl font-bold text-ink">
                    <CountUp to={t.value} duration={900} />
                  </p>
                  <p className="mt-0.5 text-[10px] text-primary-600">{t.note}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-line p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium text-muted">Stock movement · last 7 days</p>
                <p className="text-[11px] font-semibold text-ink" aria-live="polite">
                  {DAYS[active]} · {bars[active]} units
                </p>
              </div>

              <div className="mt-3 flex h-20 items-end gap-2">
                {bars.map((h, i) => (
                  <button
                    key={DAYS[i]}
                    type="button"
                    onClick={() => setActive(i)}
                    aria-label={`${DAYS[i]}: ${h} units moved`}
                    aria-pressed={active === i}
                    className="group flex h-full flex-1 items-end rounded-t-md focus-visible:outline-2 focus-visible:outline-primary-500"
                  >
                    <span
                      style={{
                        height: inView ? `${h}%` : "0%",
                        transitionDelay: sales === 0 ? `${300 + i * 70}ms` : "0ms",
                      }}
                      className={cn(
                        "block w-full rounded-t-md transition-[height,background-color] duration-700 ease-out motion-reduce:transition-none",
                        active === i ? "bg-primary-500" : "bg-[#FDECDC] group-hover:bg-primary-200",
                      )}
                    />
                  </button>
                ))}
              </div>
              <div className="mt-1.5 flex gap-2" aria-hidden="true">
                {DAYS.map((d) => (
                  <span key={d} className="flex-1 text-center text-[9px] text-muted">
                    {d}
                  </span>
                ))}
              </div>
            </div>

            <ul className="divide-y divide-line rounded-xl border border-line">
              {rows.map((r) => (
                <li
                  key={flashSku?.startsWith(r.sku) ? flashSku : r.sku}
                  className={cn(
                    "flex items-center justify-between gap-3 px-3 py-2.5",
                    flashSku?.startsWith(r.sku) && "animate-flash motion-reduce:animate-none",
                  )}
                >
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
      </TiltCard>

      <div className="absolute -bottom-5 -left-3 hidden animate-float sm:block motion-reduce:animate-none">
        <div
          key={chip.id}
          className="flex animate-pop-in items-center gap-2 rounded-2xl border border-line bg-white px-4 py-3 shadow-lg shadow-[#7A3410]/10"
        >
          <div>
            <p className="text-[11px] font-medium text-muted">Order #{chip.id}</p>
            <p className="text-sm font-semibold text-ink">{chip.text}</p>
          </div>
          <StatusBadge status={chip.status} />
        </div>
      </div>
    </div>
  );
}
