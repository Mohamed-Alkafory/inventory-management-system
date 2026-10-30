import { fromISO } from "./dates";
import { niceTicks } from "./chartMath";
import { formatMoney, formatMoneyCompact } from "./format";
import { useOverview } from "./hooks";
import Panel from "./Panel";
import type { DateRange, Granularity, SalesPoint } from "./types";

const W = 640, H = 280, ML = 56, MR = 12, MT = 12, MB = 32;

const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const dayMonth = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const monthYear = new Intl.DateTimeFormat(undefined, { month: "short", year: "2-digit" });

function label(date: string, g: Granularity, count: number) {
  const d = fromISO(date);
  if (g === "month") return monthYear.format(d);
  if (g === "day" && count <= 7) return weekday.format(d);
  return dayMonth.format(d);
}

const SUBTITLE: Record<Granularity, string> = { day: "Daily sales", week: "Weekly sales (weeks start on Monday)", month: "Monthly sales" };

function BarChart({ points, granularity }: { points: SalesPoint[]; granularity: Granularity }) {
  const max = Math.max(...points.map((p) => p.total), 0);
  if (max <= 0) return <p className="flex h-56 items-center justify-center text-sm text-[#6B7280]">No sales in this period.</p>;

  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const plotW = W - ML - MR, plotH = H - MT - MB;
  const band = plotW / points.length;
  const barW = Math.min(band * 0.62, 44);
  const y = (v: number) => MT + plotH - (v / top) * plotH;
  const every = points.length <= 12 ? 1 : Math.ceil(points.length / 10);
  const names = points.map((p) => label(p.date, granularity, points.length));

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Sales overview bar chart" className="h-auto w-full">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={ML} x2={W - MR} y1={y(t)} y2={y(t)} stroke="#F3F4F6" />
            <text x={ML - 8} y={y(t) + 4} textAnchor="end" className="fill-[#6B7280]" fontSize="11">
              {formatMoneyCompact(t)}
            </text>
          </g>
        ))}
        {points.map((p, i) => {
          const x = ML + i * band + (band - barW) / 2;
          const h = Math.max(0, MT + plotH - y(p.total));
          return (
            <g key={p.date}>
              <rect x={x} y={y(p.total)} width={barW} height={h} rx={3} className="fill-[#FF5615] hover:fill-[#E84A0E]">
                <title>{`${names[i]}: ${formatMoney(p.total)}`}</title>
              </rect>
              {i % every === 0 && (
                <text x={x + barW / 2} y={H - 10} textAnchor="middle" className="fill-[#6B7280]" fontSize="11">
                  {names[i]}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* The same data as a table, for screen readers. */}
      <table className="sr-only">
        <caption>Sales overview data</caption>
        <thead>
          <tr>
            <th>Period</th>
            <th>Sales</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={p.date}>
              <td>{names[i]}</td>
              <td>{formatMoney(p.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export default function SalesOverviewChart({ range, className = "" }: { range: DateRange; className?: string }) {
  const q = useOverview(range);
  return (
    <Panel title="Sales Overview" subtitle={q.data ? SUBTITLE[q.data.granularity] : undefined} query={q} className={className}>
      {q.data && <BarChart points={q.data.points} granularity={q.data.granularity} />}
    </Panel>
  );
}
