"use client";

import dynamic from "next/dynamic";
import DiffPill from "@/components/stats/DiffPill";
import StatCardShell from "@/components/stats/StatCardShell";
import NumberUnit from "@/components/common/NumberUnit";
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
  iconLabel?: string;
  emoji?: string;
  // Swaps out the line sparkline for something else (e.g. StepRings) - the
  // sparkline props above are still required so callers without a custom
  // visual don't need a separate prop shape.
  visual?: React.ReactNode;
  className?: string;
  // Scales the headline number relative to the 1.8rem default (e.g. 1.3 =
  // 30% bigger) - same --size-variable convention as Clock/WeatherSummary.
  valueSize?: number;
};

// Google Fit/Health Connect style tile: label, headline number, a diff pill,
// and a small trend visual - one glance covers "what" and "which way". This
// is a StatCardShell preset for that specific shape; tiles that don't fit
// "number + diff + trend" should compose StatCardShell directly instead of
// growing this prop list.
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
  iconLabel,
  emoji,
  visual,
  className,
  valueSize = 1,
}: Props) {
  return (
    <StatCardShell label={label} icon={icon} iconAlt={iconAlt} iconLabel={iconLabel} emoji={emoji} className={className}>
      <NumberUnit
        value={value != null ? value : "—"}
        unit={unit}
        size={valueSize}
        unitRatio={0.5}
        muted
        className={styles.value}
      />
      <DiffPill value={diff} unit={diffUnit ?? unit} goodDirection={goodDirection} />
      <div className={styles.trend}>
        {visual ?? <Sparkline data={sparkline} color={color} min={sparklineMin} max={sparklineMax} />}
      </div>
    </StatCardShell>
  );
}
