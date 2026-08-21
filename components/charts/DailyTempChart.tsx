"use client";

import ReactEChartsCore from "echarts-for-react/lib/core";
import { echarts, THEME_NAME } from "@/lib/echarts-setup";
import { CODE_MAP } from "@/components/weather/WeatherSummary";

type Props = {
  times: string[];
  highs: number[];
  sunshineHours?: number[];
  // Shared hourly timestamps covering the same week as `times`, plus the
  // precipitation/temperature series aligned to them - used to draw the
  // Temp line and the rain bands at hour resolution instead of one point
  // per day. Falls back to `times`/`highs` (one point per day) when absent.
  hourlyTimes?: string[];
  hourlyPrecipitation?: number[];
  hourlyTemps?: number[];
  // Per-day Open-Meteo weather code (same source as ForecastStrip), shown as
  // a small condition icon above each day's label.
  weatherCodes?: number[];
};

// Open-Meteo's daily.time is a plain "YYYY-MM-DD" - show the weekday instead
// of the full date, which is redundant clutter on a 7-day-wide axis.
function weekday(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00`);
  return Number.isNaN(date.getTime()) ? isoDate : date.toLocaleDateString(undefined, { weekday: "short" });
}

// Maps an hour's precipitation to a wash opacity - heavier rain reads as a
// more saturated band. 4mm/h is already a heavy-rain hour, so that's where
// the ramp tops out instead of scaling to whatever the wettest hour in the
// forecast happens to be.
const RAIN_MIN_ALPHA = 0.0;
const RAIN_MAX_ALPHA = 0.75;
const RAIN_MAX_MM_PER_HOUR = 4;
// How far each rainy run's wash fades in/out, in hour-widths, before hitting
// its first/last real reading - 0 is a hard edge right at the rain data,
// higher values spread the fade further into the dry hours on either side.
const RAIN_EDGE_FADE_HOURS = 0.25;
// Opacity the fade settles to at its outermost edge - 0 is fully invisible;
// raise it for a faint haze instead of a true fade-to-nothing.
const RAIN_EDGE_ALPHA = 0;
// Centered moving-average window (in hours) applied to the raw mm readings
// before they drive band intensity/threshold - raw hourly forecasts can
// jitter hour to hour, which otherwise reads as a jagged run of bands
// instead of a smooth rise and fall in intensity.
const RAIN_SMOOTHING_WINDOW_HOURS = 3;
// Same idea, applied to the Temp line's hourly readings.
const TEMP_SMOOTHING_WINDOW_HOURS = 3;
function rainAlpha(mm: number): number {
  const t = Math.min(mm / RAIN_MAX_MM_PER_HOUR, 1);
  return RAIN_MIN_ALPHA + t * (RAIN_MAX_ALPHA - RAIN_MIN_ALPHA);
}

// Daily counterpart to the old HourlyTempChart - same reusable chart shape,
// driven by per-day high/sunshine arrays (rain bands are the exception -
// those come from the hourly precipitation series so each day's band can be
// split into per-hour intensity instead of one flat wash for the whole day).
export default function DailyTempChart({
  times,
  highs,
  sunshineHours,
  hourlyTimes,
  hourlyPrecipitation,
  hourlyTemps,
  weatherCodes,
}: Props) {
  // Right margin has to fit each line's endLabel text (near the last data
  // point) and the extra axes' own tick labels, which sit further out.
  const gridRight = 60 + (sunshineHours ? 30 : 0);

  // The tick/gridline axis runs on day *boundaries* (midnight), not day
  // values, so ticks land at 12am of the day before and after each day's
  // span rather than on the day itself - one boundary per real day, plus
  // one synthetic boundary the day after the last, so the final day gets a
  // closing tick too. A separate axis (below) draws the weekday labels
  // centered inside each day's slot between two consecutive boundaries.
  function nextDay(dateStr: string): string {
    const d = new Date(`${dateStr}T00:00`);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  const boundaries = [...times, nextDay(times[times.length - 1])];

  const paddedBoundaries = ["", ...boundaries, ""];

  // Per-day condition icon shown above the weekday label (same icon set as
  // ForecastStrip). ECharts axisLabel can't take arbitrary JSX, so each
  // day's icon is registered as its own named `rich` style (keyed by index)
  // and the formatter below stitches the right token in per label.
  const dayIconRich: Record<string, unknown> = {};
  times.forEach((_, i) => {
    const code = weatherCodes?.[i];
    if (code == null) return;
    const [, icon] = CODE_MAP[code] ?? CODE_MAP[999];
    if (icon === "undefined") return;
    dayIconRich[`icon${i}`] = {
      height: 18,
      width: 18,
      align: "center",
      verticalAlign: "middle",
      backgroundColor: { image: `/assets/weather/icons/v1/${icon}.png` },
    };
  });
  const pad = <T,>(arr?: T[]) => (arr ? [null, ...arr, null] : undefined);

  // Temp and rain both plot on the hidden value axis (below) rather than the
  // boundary axis - ECharts markArea (and, here, a sub-day-resolution line)
  // on a category axis only accepts its exact tick values (label or integer
  // index), so the fractional "partway through day N" coordinates an
  // hour-resolution point needs would silently fail to render there. A
  // value axis has no such restriction. Day dayIdx spans value-axis units
  // [dayIdx, dayIdx+1), matching that axis's min/max below 1:1 with the
  // category axis's visible day range.
  //
  // Bucket the shared hourly series by calendar day, so each day's rain (if
  // any) can be drawn as its own run of hour-wide bands, and the Temp line
  // can be drawn through each hour's actual reading, instead of one flat
  // value for the whole day.
  const hoursByDay = new Map<string, { mm: number; temp: number | null }[]>();
  hourlyTimes?.forEach((t, i) => {
    const date = t.slice(0, 10);
    if (!hoursByDay.has(date)) hoursByDay.set(date, []);
    hoursByDay.get(date)!.push({
      mm: hourlyPrecipitation?.[i] ?? 0,
      temp: hourlyTemps?.[i] ?? null,
    });
  });

  const hourPoints: { x0: number; x1: number; mm: number }[] = [];
  const hourlyTempPoints: [number, number][] = [];
  times.forEach((date, dayIdx) => {
    const hours = hoursByDay.get(date);
    if (!hours?.length) return;
    hours.forEach(({ mm, temp }, h) => {
      hourPoints.push({
        x0: dayIdx + h / hours.length,
        x1: dayIdx + (h + 1) / hours.length,
        mm: mm ?? 0,
      });
      if (temp != null) hourlyTempPoints.push([dayIdx + (h + 0.5) / hours.length, temp]);
    });
  });

  // A bezier `smooth` curve still passes exactly through every data point,
  // so hour-to-hour jitter in the raw forecast reads as little kinks no
  // matter how high that setting goes - a centered moving average over the
  // readings themselves is what actually flattens it, while still tracking
  // the real rise/fall of each day. Shared by the Temp line and the rain
  // bands below.
  function movingAverage(points: [number, number][], window: number): [number, number][] {
    const half = Math.floor(window / 2);
    return points.map(([x], i) => {
      const slice = points.slice(Math.max(0, i - half), Math.min(points.length, i + half + 1));
      const avg = slice.reduce((sum, [, y]) => sum + y, 0) / slice.length;
      return [x, avg];
    });
  }

  // Temp plots at each reading's own position when hourly data is
  // available, falling back to one point at each day's *center* -
  // dayIdx+0.5 - lining up under that day's centered label. Either way, a
  // lead-in point extrapolated from the first two real points sits just off
  // the value axis's min:0, so the line visibly runs in from off-grid
  // instead of starting dead at the edge; the axis's own right-hand margin
  // (max is one full day past the last day's center) means the line can
  // just end cleanly without needing the same trick on that side.
  const realTempPoints: [number, number][] = hourlyTempPoints.length
    ? movingAverage(hourlyTempPoints, TEMP_SMOOTHING_WINDOW_HOURS)
    : highs.map((v, i) => [i + 0.5, v]);
  const [p0, p1] = realTempPoints;
  const leadX = -0.5;
  const leadSlope = p1 ? (p1[1] - p0[1]) / (p1[0] - p0[0]) : 0;
  const tempData: [number, number][] = [
    [leadX, p0[1] - leadSlope * (p0[0] - leadX)],
    ...realTempPoints,
  ];

  // Smooth the raw per-hour mm readings before anything else uses them, so
  // both which hours count as "rainy" (the threshold below) and how intense
  // each band reads are driven by the smoothed curve, not hour-to-hour noise
  // in the forecast.
  const smoothedMm = movingAverage(
    hourPoints.map((p) => [(p.x0 + p.x1) / 2, p.mm]),
    RAIN_SMOOTHING_WINDOW_HOURS
  );
  const smoothedHourPoints = hourPoints.map((p, i) => ({ ...p, mm: smoothedMm[i][1] }));

  // Collapse contiguous rainy hours into one run so the wash reads as a
  // continuous gradient instead of a strip of hard-edged blocks - each run
  // becomes a single rectangle with a horizontal gradient stop per hour,
  // so intensity still steps with the actual per-hour rainfall.
  const rainRuns: { x0: number; x1: number; mm: number }[][] = [];
  let currentRun: { x0: number; x1: number; mm: number }[] = [];
  smoothedHourPoints.forEach((p) => {
    if (p.mm > 0.1) {
      currentRun.push(p);
    } else if (currentRun.length) {
      rainRuns.push(currentRun);
      currentRun = [];
    }
  });
  if (currentRun.length) rainRuns.push(currentRun);

  const rainSegments = rainRuns.map((run) => {
    // The rectangle itself is widened by RAIN_EDGE_FADE_HOURS worth of hour
    // slots on each side, extending it into the surrounding dry hours - the
    // fade then happens across that padding, from RAIN_EDGE_ALPHA at the
    // rectangle's true edges up to each real hour's own intensity. Stop
    // offsets are recomputed against the padded rectangle's own width so
    // they land in the right place regardless of how much padding is added.
    const startHourWidth = run[0].x1 - run[0].x0;
    const endHourWidth = run[run.length - 1].x1 - run[run.length - 1].x0;
    const rectX0 = run[0].x0 - startHourWidth * RAIN_EDGE_FADE_HOURS;
    const rectX1 = run[run.length - 1].x1 + endHourWidth * RAIN_EDGE_FADE_HOURS;
    const rectWidth = rectX1 - rectX0;
    const colorStops = [
      { offset: 0, color: `rgba(91, 155, 213, ${RAIN_EDGE_ALPHA})` },
      ...run.map((p) => ({
        offset: ((p.x0 + p.x1) / 2 - rectX0) / rectWidth,
        color: `rgba(91, 155, 213, ${rainAlpha(p.mm)})`,
      })),
      { offset: 1, color: `rgba(91, 155, 213, ${RAIN_EDGE_ALPHA})` },
    ];
    return [
      {
        xAxis: rectX0,
        itemStyle: { color: { type: "linear", x: 0, y: 0, x2: 1, y2: 0, colorStops } },
      },
      { xAxis: rectX1 },
    ];
  });

  const series: Record<string, unknown>[] = [
    {
      name: "Temp",
      type: "line",
      xAxisIndex: 1,
      data: tempData,
      showSymbol: false,
      smooth: 0.35,
      clip: false,
      // areaStyle: { color: "#5b9bd5", opacity: 0.55 },
      endLabel: { show: true, formatter: "{a}", color: "#5b9bd5" },
    },
    {
      name: "RainBands",
      type: "line",
      xAxisIndex: 1,
      data: [],
      silent: true,
      showSymbol: false,
      markArea: rainSegments.length ? { data: rainSegments } : undefined,
    },
  ];

  const yAxis: Record<string, unknown>[] = [
    { type: "value", scale: true, axisLabel: { formatter: "{value}°" } },
  ];

  // if (sunshineHours) {
  //   yAxis.push({
  //     type: "value",
  //     show: false,
  //     min: 0,
  //   });
  //   series.push({
  //     name: "Sunshine",
  //     type: "bar",
  //     yAxisIndex: yAxis.length - 1,
  //     data: pad(sunshineHours),
  //     barMaxWidth: 14,
  //     itemStyle: { color: "#f2c94c", opacity: 0.55, borderRadius: [4, 4, 0, 0] },
  //   });
  // }

  return (
    <ReactEChartsCore
      echarts={echarts}
      theme={THEME_NAME}
      style={{ height: "100%", width: "100%" }}
      option={{
        tooltip: { trigger: "axis" },
        grid: { left: 50, right: gridRight, top: 16, bottom: 25 },
        xAxis: [
          {
            type: "category",
            boundaryGap: false,
            data: paddedBoundaries,
            min: boundaries[0],
            max: boundaries[boundaries.length - 1],
            axisLabel: { show: false },
            axisTick: { show: true, alignWithLabel: true, inside: true, length: 20, lineStyle: { color: "#23272c" } },
            splitLine: { show: false },
          },
          { type: "value", show: false, min: 0, max: times.length },
          {
            type: "category",
            data: times,
            position: "bottom",
            offset: 0,
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { show: false },
            axisLabel: {
              formatter: (value: string, index: number) => {
                const label = `${weekday(value)} ${Math.round(highs[index])}°`;
                return dayIconRich[`icon${index}`] ? `{icon${index}|} ${label}` : label;
              },
              rich: dayIconRich,
              fontSize: 14,
            },
          },
        ],
        yAxis,
        visualMap: {
          show: false,
          seriesIndex: 0,
          dimension: 1,
          min: Math.min(...realTempPoints.map((p) => p[1])),
          max: Math.max(...realTempPoints.map((p) => p[1])),
          inRange: { color: ["#5b9bd5", "#3fb8af", "#e8c15a", "#e0703f"] },
        },
        series,
      }}
    />
  );
}
