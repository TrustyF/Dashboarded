// Centered moving average - smooths reading-to-reading jitter while still
// tracking the real rise and fall of the underlying values. A bezier
// `smooth` curve on a chart series still passes exactly through every data
// point, so raw noise still shows up as little kinks no matter how high
// that setting goes; averaging the readings themselves is what actually
// flattens it. Originally lived only in DailyTempChart.tsx - pulled out
// here once SensorHistoryChart needed the same treatment.
export function movingAverage(points: [number, number][], window: number): [number, number][] {
  const half = Math.floor(window / 2);
  return points.map(([x], i) => {
    const slice = points.slice(Math.max(0, i - half), Math.min(points.length, i + half + 1));
    const avg = slice.reduce((sum, [, y]) => sum + y, 0) / slice.length;
    return [x, avg];
  });
}

// Null-tolerant variant for a plain reading series (SensorHistoryChart's
// temp/humidity, where a missed poll leaves a null gap) - null entries are
// excluded from neighboring windows instead of poisoning the average, and
// stay null in the output so gaps still render as gaps (via the chart's
// own connectNulls) instead of being smoothed into a fabricated reading.
export function movingAverageNullable(values: (number | null)[], window: number): (number | null)[] {
  const half = Math.floor(window / 2);
  return values.map((v, i) => {
    if (v == null) return null;
    const slice = values
      .slice(Math.max(0, i - half), Math.min(values.length, i + half + 1))
      .filter((n): n is number => n != null);
    return slice.reduce((sum, n) => sum + n, 0) / slice.length;
  });
}
