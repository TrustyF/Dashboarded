"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useFitbit } from "@/lib/hooks";
import { avgDiff, goalProgressPercent, lastValue } from "@/lib/fitbit-metrics";
import StatCard from "@/components/stats/StatCard";
import StepRings, { STEPS_GOAL } from "@/components/stats/StepRings";
import RangeSelector from "@/components/health/RangeSelector";
import styles from "./page.module.sass";

// ECharts is a ~650KB chunk - loading it eagerly blocks hydration (and so
// the SWR fetch that clears the "Loading…" state) behind that download+parse
// on top of the page's own JS. Deferring it keeps the shell interactive and
// the data fetch running while the chart chunk loads in the background.
const WeightChart = dynamic(() => import("@/components/charts/WeightChart"), { ssr: false });

// Google Fit/Health Connect style overview: quick-glance stat tiles up top,
// the detailed trend chart underneath.
export default function HealthPage() {
  const [days, setDays] = useState(29);
  const { data, isLoading } = useFitbit(days);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h1 className={styles.title}>Health</h1>
        <RangeSelector value={days} onChange={setDays} />
      </div>

      {isLoading ? (
        <p>Loading…</p>
      ) : data?.error === "invalid-credentials" ? (
        <p>Google Health credentials are invalid or expired - re-run the token bootstrap.</p>
      ) : data?.error ? (
        <p>Google Health is rate-limiting requests right now - try again in a bit.</p>
      ) : !data?.weight?.length ? (
        <p>No weight data for this range.</p>
      ) : (
        <>
          <div className={styles.statGrid}>
            <StatCard
              label="Weight"
              value={lastValue(data.weight)}
              unit="kg"
              diff={avgDiff(data.weight)}
              color="#81b29a"
              sparkline={data.weight.map((p: { value: number | null }) => p.value)}
            />
            <StatCard
              label="Body fat"
              value={lastValue(data.fat)}
              unit="%"
              diff={avgDiff(data.fat)}
              color="#e07a5f"
              sparkline={data.fat.map((p: { value: number | null }) => p.value)}
            />
            <StatCard
              label="Steps (5d)"
              value={goalProgressPercent(data.steps, STEPS_GOAL)}
              unit="%"
              diff={avgDiff(data.steps)}
              diffUnit=""
              color="#f2cc8f"
              sparkline={data.steps.map((p: { value: number | null }) => p.value)}
              goodDirection="up"
              visual={<StepRings days={data.steps} color="#f2cc8f" />}
            />
          </div>

          <div className={styles.trendCard}>
            <div className={styles.trendHeader}>Weight &amp; body fat trend</div>
            <div className={styles.trendChart}>
              <WeightChart weight={data.weight} fat={data.fat} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
