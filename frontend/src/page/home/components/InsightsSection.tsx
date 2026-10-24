import { Check } from "lucide-react";
import { Card, CardHeader } from "../../../components/ui/Card";
import StatusBadge from "../../../components/ui/StatusBadge";
import { ALERTS, INSIGHT_POINTS } from "../data/content";

export default function InsightsSection() {
  return (
    <section className="w-full bg-[#FDF6F0]/70 px-4 py-16 sm:px-6 sm:py-20 lg:px-10">
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
        <div>
          <div className="flex items-center gap-3">
            <span className="h-0.5 w-8 bg-primary-500" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-widest text-primary-600">Stock Monitoring</span>
          </div>
          <h2 className="mt-4 text-3xl font-bold leading-tight text-ink sm:text-4xl">
            Never Run Out.
            <br className="hidden sm:block" /> Never Overstock.
          </h2>
          <p className="mt-5 max-w-lg leading-relaxed text-muted">
            Real-time stock levels and clear alerts tell you what to reorder and when, so shelves stay full and cash
            is not tied up in products that sit.
          </p>

          <ul className="mt-8 space-y-3">
            {INSIGHT_POINTS.map((p) => (
              <li key={p} className="flex items-center gap-3 text-sm font-medium text-ink">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-white">
                  <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        <Card className="border-[#FDECDC] shadow-lg shadow-[#7A3410]/10">
          <CardHeader title="Stock alerts" description="Products that need your attention" />
          <ul className="divide-y divide-line">
            {ALERTS.map((a) => {
              const pct = Math.min(100, Math.round((a.stock / (a.reorderAt * 2)) * 100));
              return (
                <li key={a.sku} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{a.name}</p>
                      <p className="text-xs text-muted">
                        {a.sku} · {a.stock} in stock · reorder at {a.reorderAt}
                      </p>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                    <div
                      style={{ width: `${pct}%` }}
                      className={`h-full rounded-full ${
                        a.status === "in_stock"
                          ? "bg-success-600"
                          : a.status === "low_stock"
                            ? "bg-warning-600"
                            : "bg-danger-600"
                      }`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </section>
  );
}
