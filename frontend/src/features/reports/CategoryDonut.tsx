import { groupTopN, percentages } from "./chartMath";
import { formatMoney, formatMoneyCompact } from "./format";
import { useCategories } from "./hooks";
import Panel from "./Panel";
import type { CategorySales, DateRange } from "./types";
import { COLORS } from "./colors";

const R = 70, C = 2 * Math.PI * R;

function Donut({ categories }: { categories: CategorySales[] }) {
  const slices = groupTopN(categories, 5);
  const total = slices.reduce((s, c) => s + c.total, 0);
  if (total <= 0) return <p className="flex h-56 items-center justify-center text-sm text-[#6B7280]">No sales in this period.</p>;

  const pcts = percentages(slices.map((s) => s.total));
  const lengths = slices.map((s) => (s.total / total) * C);
  const offsets = lengths.reduce<number[]>((acc, len) => {
    const prev = acc.length > 0 ? acc[acc.length - 1] : 0;
    acc.push(prev + len);
    return acc;
  }, []);

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <svg viewBox="0 0 200 200" role="img" aria-label="Sales by category donut chart" className="h-44 w-44 shrink-0">
        <g transform="rotate(-90 100 100)" fill="none" strokeWidth="28">
          <circle cx="100" cy="100" r={R} stroke="#F3F4F6" />
          {slices.map((s, i) => {
            const len = lengths[i];
            const offset = offsets[i - 1] ?? 0;
            return (
              <circle key={s.name} cx="100" cy="100" r={R} stroke={COLORS[i % COLORS.length]} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset}>
                <title>{`${s.name}: ${formatMoney(s.total)} (${pcts[i]}%)`}</title>
              </circle>
            );
          })}
        </g>
        <text x="100" y="96" textAnchor="middle" className="fill-[#6B7280]" fontSize="11">
          Total
        </text>
        <text x="100" y="116" textAnchor="middle" className="fill-[#111827]" fontSize="18" fontWeight="800">
          {formatMoneyCompact(total)}
        </text>
      </svg>

      <ul className="w-full space-y-2.5 text-sm" aria-label="Sales by category">
        {slices.map((s, i) => (
          <li key={s.name} className="flex items-center gap-2.5">
            <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            <span className="flex-1 font-medium text-[#374151]">{s.name}</span>
            <span className="text-xs text-[#6B7280]">{formatMoney(s.total)}</span>
            <span className="w-10 text-right font-bold text-[#111827]">{pcts[i]}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function CategoryDonut({ range, className = "" }: { range: DateRange; className?: string }) {
  const q = useCategories(range);
  return (
    <Panel title="Sales by Category" subtitle="Share of sales in the selected period" query={q} className={className}>
      {q.data && <Donut categories={q.data} />}
    </Panel>
  );
}
