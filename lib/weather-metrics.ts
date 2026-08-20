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

// WHO/EPA UV Index scale.
export function uvCategory(uvIndex: number | null | undefined): string | undefined {
  if (uvIndex == null) return undefined;
  if (uvIndex < 3) return "Low";
  if (uvIndex < 6) return "Moderate";
  if (uvIndex < 8) return "High";
  if (uvIndex < 11) return "Very High";
  return "Extreme";
}

// Sunglasses once it's worth squinting about, sunscreen once it's worth
// burning about, a warning once it's worth avoiding altogether.
export function uvIcon(uvIndex: number | null | undefined): string | undefined {
  if (uvIndex == null) return undefined;
  if (uvIndex >= 8) return "⚠️";
  if (uvIndex >= 6) return "🧴";
  if (uvIndex >= 3) return "🕶️";
  return undefined;
}
