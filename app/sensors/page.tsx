"use client";

import dynamic from "next/dynamic";
import { useSensorCurrent, useSensorHistory } from "@/lib/hooks";
import styles from "./page.module.sass";

// See app/weather/page.tsx's HourlyTempChart import for why this is deferred.
const SensorHistoryChart = dynamic(() => import("@/components/charts/SensorHistoryChart"), { ssr: false });

export default function SensorsPage() {
  const { data: current } = useSensorCurrent();
  const { data: history, isLoading } = useSensorHistory();

  return (
    <div className={styles.wrapper}>
      <div className={styles.card} style={{ maxWidth: 300 }}>
        <h2>Current</h2>
        <div className={styles.big}>{current?.temp != null ? `${current.temp}°C` : "—"}</div>
        <div>{current?.humidity != null ? `${current.humidity}% humidity` : ""}</div>
      </div>

      <div className={styles.card} style={{ height: "34vh" }}>
        <h2>History</h2>
        {isLoading || !history?.time?.length ? (
          <p>Waiting for sensor readings…</p>
        ) : (
          <div style={{ height: "26vh" }}>
            <SensorHistoryChart times={history.time} temp={history.temp} humidity={history.humidity} />
          </div>
        )}
      </div>
    </div>
  );
}
