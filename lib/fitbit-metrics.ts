export type Point = { dateTime: string; value: number | null };

// Port of weight_store.js's diff getters. The original divided by a
// hardcoded 10 regardless of how many points were actually in the trailing
// window, which understates the average (and inflates the diff) whenever
// there's less than 10 days of history - divides by the actual window size
// here instead.

export function lastValue(points: Point[] | undefined): number | null {
  if (!points || points.length === 0) return null;
  return points[points.length - 1].value;
}

export function lastDiff(points: Point[] | undefined): number | null {
  if (!points || points.length < 2) return null;
  const current = points[points.length - 1].value;
  const prev = points[points.length - 2].value;
  if (current == null || prev == null) return null;
  return Math.round((current - prev) * 10) / 10;
}

export function avgDiff(points: Point[] | undefined): number | null {
  if (!points || points.length < 1) return null;
  const current = points[points.length - 1].value;
  if (current == null) return null;
  const window = points.slice(-11, -1);
  if (window.length === 0) return null;
  const avg = window.reduce((sum, p) => sum + (p.value ?? 0), 0) / window.length;
  return Math.round((current - avg) * 10) / 10;
}

// e.g. steps over the last 5 days against a daily goal - total actual over
// total possible (goalPerDay * number of days), not an average of daily %s,
// so a big day can offset a lighter one instead of every day being weighted
// equally regardless of how far it missed the goal.
export function goalProgressPercent(points: Point[] | undefined, goalPerDay: number): number | null {
  if (!points || points.length === 0) return null;
  const total = points.reduce((sum, p) => sum + (p.value ?? 0), 0);
  return Math.round((total / (goalPerDay * points.length)) * 100);
}
