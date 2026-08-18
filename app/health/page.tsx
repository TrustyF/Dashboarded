"use client";

import { useFitbit } from "@/lib/hooks";
import WeightChart from "@/components/charts/WeightChart";
import DiffNumber from "@/components/fitbit/DiffNumber";

// Visual port of HealthView.vue.

type Point = { dateTime: string; value: number | null };

// Port of weight_store.js's diff getters. The original divided by a
// hardcoded 10 regardless of how many points were actually in the trailing
// window, which understates the average (and inflates the diff) whenever
// there's less than 10 days of history - divides by the actual window size
// here instead.
function lastDiff(points: Point[] | undefined): number | null {
  if (!points || points.length < 2) return null;
  const current = points[points.length - 1].value;
  const prev = points[points.length - 2].value;
  if (current == null || prev == null) return null;
  return Math.round((current - prev) * 10) / 10;
}

function avgDiff(points: Point[] | undefined): number | null {
  if (!points || points.length < 1) return null;
  const current = points[points.length - 1].value;
  if (current == null) return null;
  const window = points.slice(-11, -1);
  if (window.length === 0) return null;
  const avg = window.reduce((sum, p) => sum + (p.value ?? 0), 0) / window.length;
  return Math.round((current - avg) * 10) / 10;
}

export default function HealthPage() {
  const { data, isLoading } = useFitbit();

  return (
    <div id="health_wrapper">
      <div className="health_graph">
        {isLoading || !data?.weight?.length ? <p>Loading…</p> : <WeightChart weight={data.weight} />}
      </div>

      <div className="diff_wrapper">
        <DiffNumber number={lastDiff(data?.weight)} title="Weight diff" />
        <DiffNumber number={avgDiff(data?.weight)} title="Avg weight diff" />
        <DiffNumber number={lastDiff(data?.fat)} title="Fat diff" />
        <DiffNumber number={avgDiff(data?.fat)} title="Avg fat diff" />
      </div>
    </div>
  );
}
