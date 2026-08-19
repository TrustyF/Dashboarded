"use client";

import dynamic from "next/dynamic";
import DiffPill from "@/components/stats/DiffPill";
import styles from "./StatCard.module.sass";

// See app/health/page.tsx's WeightChart import for why this is deferred.
const Sparkline = dynamic(() => import("@/components/charts/Sparkline"), { ssr: false });

type Props = {
  label: string;
  value: number | null;
  unit: string;
  diff: number | null;
  // Diff pill's unit, when it isn't measured in the same unit as the
  // headline value (e.g. headline is "% of goal" but diff is a raw count).
  // Defaults to `unit`.
  diffUnit?: string;
  color: string;
  sparkline: (number | null)[];
  sparklineMin?: number;
  sparklineMax?: number;
  goodDirection?: "down" | "up" | "neutral";
  icon?: string;
  iconAlt?: string;
  // Swaps out the line sparkline for something else (e.g. StepRings) - the
  // sparkline props above are still required so callers without a custom
  // visual don't need a separate prop shape.
  visual?: React.ReactNode;
};

// Google Fit/Health Connect style tile: label, headline number, a diff pill,
// and a small trend visual - one glance covers "what" and "which way".
export default function StatCard({
  label,
  value,
  unit,
  diff,
  diffUnit,
  color,
  sparkline,
  sparklineMin,
  sparklineMax,
  goodDirection,
  icon,
  iconAlt,
  visual,
}: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.topRow}>
        <div className={styles.label}>{label}</div>
        {icon && <img className={styles.icon} src={icon} alt={iconAlt ?? ""} />}
      </div>
      <div className={styles.value}>
        {value != null ? value : "—"}
        <span className={styles.unit}>{unit}</span>
      </div>
      <DiffPill value={diff} unit={diffUnit ?? unit} goodDirection={goodDirection} />
      {visual ?? <Sparkline data={sparkline} color={color} min={sparklineMin} max={sparklineMax} />}
    </div>
  );
}
