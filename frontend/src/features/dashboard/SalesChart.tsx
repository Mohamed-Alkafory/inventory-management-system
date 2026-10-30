import { formatDay, fromISO } from "../../lib/dateRange";
import { niceTicks } from "./chartMath";
import { formatInt, formatMoney, formatMoneyCompact } from "./format";
import { useDashboardSales } from "./hooks";
import WidgetCard from "./WidgetCard";
import type { DateRange, SalesDay } from "./types";

const W = 640;
const H = 280;
const ML = 64;
const MR = 12;
const MT = 12;
const MB = 32;

const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const dayMonth = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

const label = (date: string, count: number) =>
  count <= 7 ? weekday.format(fromISO(date)) : dayMonth.format(fromISO(date));

function SalesBars({ data }: { data: SalesDay[] }) {
  const max = Math.max(0, ...data.map((d) => d.totalSales));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const plotW = W - ML - MR;
  const plotH = H - MT - MB;
  const band = plotW / Math.max(data.length, 1);
  const barW = Math.min(band * 0.62, 44);
  const y = (v: number) => MT + plotH - (v / top) * plotH;
  const every = data.length <= 12 ? 1 : Math.ceil(data.length / 10);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Daily sales chart" className="h-auto w-full">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={ML} x2={W - MR} y1={y(t)} y2={y(t)} stroke="#F3F4F6" />
            <text x={ML - 8} y={y(t) + 4} textAnchor="end" className="fill-[#6B7280]" fontSize="11">
              {formatMoneyCompact(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = ML + i * band + (band - barW) / 2;
          return (
            <g key={d.date}>
              <rect
                x={x}
                y={y(d.totalSales)}
                width={barW}
                height={Math.max(0, MT + plotH - y(d.totalSales))}
                rx={3}
                className="fill-[#FF5615] hover:fill-[#E84A0E]"
              >
                <title>{`${formatDay(d.date)}: ${formatMoney(d.totalSales)} (${formatInt(d.orderCount)} orders)`}</title>
              </rect>
              {i % every === 0 && (
                <text x={x + barW / 2} y={H - 10} textAnchor="middle" className="fill-[#6B7280]" fontSize="11">
                  {label(d.date, data.length)}
                </text>
              )}
            </g>
          );
        })}
        {max <= 0 && (
          <text x={ML + plotW / 2} y={MT + plotH / 2} textAnchor="middle" className="fill-[#6B7280]" fontSize="13">
            No sales in this period.
          </text>
        )}
      </svg>

      {data.length > 0 && (
        // sr-only goes on a wrapper: a <table> ignores the 1px height, so
        // applying it to the table itself leaves a tall off-screen box that
        // adds phantom white space below the dashboard.
        <div className="sr-only">
          <table>
            <caption>Daily sales</caption>
            <thead>
              <tr>
                <th>Day</th>
                <th>Sales</th>
                <th>Orders</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.date}>
                  <td>{formatDay(d.date)}</td>
                  <td>{formatMoney(d.totalSales)}</td>
                  <td>{formatInt(d.orderCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function SalesChart({ range }: { range: DateRange }) {
  const query = useDashboardSales(range);
  return (
    <WidgetCard
      title="Sales"
      description="Revenue per day in the selected period"
      query={query}
    >
      {query.data && <SalesBars data={query.data} />}
    </WidgetCard>
  );
}
