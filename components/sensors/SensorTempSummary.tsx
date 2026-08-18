"use client";

import { useSensorHistory } from "@/lib/hooks";
import TemperatureSingleton from "@/components/weather/TemperatureSingleton";
import styles from "./SensorTempSummary.module.sass";

// Port of SensorTempSummary.vue. The original indexed temps[0] as "the latest
// reading" and averaged from the tail of the array - that assumed the backend
// prepended new readings to the front. sensor_poller/poll.py (see repo root)
// appends instead, so "latest" here is the last element, not the first.

const TREND_WINDOW = 80;
const TREND_MARGIN = 1.5;

export default function SensorTempSummary({ size = 1 }: { size?: number }) {
  const { data } = useSensorHistory();
  const temps: (number | null)[] = data?.temp ?? [];
  const readings = temps.filter((t): t is number => t != null);

  if (readings.length === 0) {
    return <div className={styles.wrapper} />;
  }

  const latest = readings[readings.length - 1];
  const trailing = readings.slice(-(TREND_WINDOW + 1), -1);
  const avg = trailing.length > 0 ? trailing.reduce((sum, t) => sum + t, 0) / trailing.length : latest;

  const diff = latest - avg;
  const trend = Math.abs(diff) > TREND_MARGIN ? (diff > 0 ? "up" : "down") : null;

  return (
    <div className={styles.wrapper} style={{ "--size": size } as React.CSSProperties}>
      <div className={styles.header}>
        <TemperatureSingleton temperature={Math.round(avg * 10) / 10} size={size} />
        <div className={styles.trend}>
          {trend === "up" && <div className={styles.trendArrow}>▲</div>}
          {trend === "down" && <div className={styles.trendArrow}>▼</div>}
          <div>{latest}</div>
        </div>
      </div>
    </div>
  );
}
