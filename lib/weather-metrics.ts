// Net change across an hourly forecast window (last reading minus first) -
// weather's equivalent of fitbit-metrics's avgDiff, just without a trailing
// "current vs history" split since there's no past/future distinction here,
// only a forecast window.
export function netChange(values: (number | null)[] | undefined): number | null {
  if (!values) return null;
  const nums = values.filter((v): v is number => v != null);
  if (nums.length < 2) return null;
  return Math.round((nums[nums.length - 1] - nums[0]) * 10) / 10;
}
