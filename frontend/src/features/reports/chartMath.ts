/** Axis ticks from 0 up to a "nice" top value that covers `max`. */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const rough = max / count;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 1000; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

/** Whole-number percentages that always add up to 100 (largest-remainder method). */
export function percentages(values: number[]): number[] {
  const sum = values.reduce((a, b) => a + b, 0);
  if (sum <= 0) return values.map(() => 0);
  const raw = values.map((v) => (v / sum) * 100);
  const floors = raw.map(Math.floor);
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, rem: r - floors[i] })).sort((a, b) => b.rem - a.rem);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  return floors;
}

/** Keep the biggest `n` slices and fold the rest into "Others". */
export function groupTopN<T extends { name: string; total: number }>(items: T[], n = 5): Array<{ name: string; total: number }> {
  const sorted = [...items].sort((a, b) => b.total - a.total);
  if (sorted.length <= n) return sorted.map(({ name, total }) => ({ name, total }));
  const rest = sorted.slice(n).reduce((s, i) => s + i.total, 0);
  return [...sorted.slice(0, n).map(({ name, total }) => ({ name, total })), { name: "Others", total: rest }];
}
