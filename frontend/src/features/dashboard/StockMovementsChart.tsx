import { formatDay, fromISO } from "../../lib/dateRange";
import { niceTicks } from "./chartMath";
import { formatInt } from "./format";
import { useDashboardStockMovements } from "./hooks";
import WidgetCard from "./WidgetCard";
import type { DateRange, StockMovementDay } from "./types";

const W = 640;
const H = 280;
const ML = 48;
const MR = 12;
const MT = 12;
const MB = 32;
const IN_COLOR = "#14B8A6";
const OUT_COLOR = "#FF5615";

const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const dayMonth = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

const label = (date: string, count: number) =>
  count <= 7 ? weekday.format(fromISO(date)) : dayMonth.format(fromISO(date));

function Legend() {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-4 text-xs font-semibold text-[#6B7280]">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: IN_COLOR }} aria-hidden="true" />
        Units in
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: OUT_COLOR }} aria-hidden="true" />
        Units out
      </span>
    </div>
  );
}

function MovementBars({ data }: { data: StockMovementDay[] }) {
  const max = Math.max(0, ...data.flatMap((d) => [d.unitsIn, d.unitsOut]));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const plotW = W - ML - MR;
  const plotH = H - MT - MB;
  const band = plotW / Math.max(data.length, 1);
  const pairW = Math.min(band * 0.72, 52);
  const barW = Math.max(1, pairW / 2 - 1);
  const y = (v: number) => MT + plotH - (v / top) * plotH;
  const every = data.length <= 12 ? 1 : Math.ceil(data.length / 10);

  return (
    <div>
      <Legend />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Stock movements chart, units in versus units out" className="h-auto w-full">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={ML} x2={W - MR} y1={y(t)} y2={y(t)} stroke="#F3F4F6" />
            <text x={ML - 8} y={y(t) + 4} textAnchor="end" className="fill-[#6B7280]" fontSize="11">
              {formatInt(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const center = ML + i * band + band / 2;
          return (
            <g key={d.date}>
              <rect
                x={center - barW - 1}
                y={y(d.unitsIn)}
                width={barW}
                height={Math.max(0, MT + plotH - y(d.unitsIn))}
                rx={2}
                fill={IN_COLOR}
              >
                <title>{`${formatDay(d.date)}: ${formatInt(d.unitsIn)} units in`}</title>
              </rect>
              <rect
                x={center + 1}
                y={y(d.unitsOut)}
                width={barW}
                height={Math.max(0, MT + plotH - y(d.unitsOut))}
                rx={2}
                fill={OUT_COLOR}
              >
                <title>{`${formatDay(d.date)}: ${formatInt(d.unitsOut)} units out`}</title>
              </rect>
              {i % every === 0 && (
                <text x={center} y={H - 10} textAnchor="middle" className="fill-[#6B7280]" fontSize="11">
                  {label(d.date, data.length)}
                </text>
              )}
            </g>
          );
        })}
        {max <= 0 && (
          <text x={ML + plotW / 2} y={MT + plotH / 2} textAnchor="middle" className="fill-[#6B7280]" fontSize="13">
            No stock movements in this period.
          </text>
        )}
      </svg>

      {data.length > 0 && (
        // sr-only goes on a wrapper: a <table> ignores the 1px height, so
        // applying it to the table itself leaves a tall off-screen box that
        // adds phantom white space below the dashboard.
        <div className="sr-only">
          <table>
            <caption>Stock movements</caption>
            <thead>
              <tr>
                <th>Day</th>
                <th>Units in</th>
                <th>Units out</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.date}>
                  <td>{formatDay(d.date)}</td>
                  <td>{formatInt(d.unitsIn)}</td>
                  <td>{formatInt(d.unitsOut)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function StockMovementsChart({ range }: { range: DateRange }) {
  const query = useDashboardStockMovements(range);
  return (
    <WidgetCard title="Stock movements" description="Units added and removed per day" query={query}>
      {query.data && <MovementBars data={query.data} />}
    </WidgetCard>
  );
}
