"use client";

import { useSensorCurrent, useSensorHistory } from "@/lib/hooks";
import SensorHistoryChart from "@/components/charts/SensorHistoryChart";

export default function SensorsPage() {
  const { data: current } = useSensorCurrent();
  const { data: history, isLoading } = useSensorHistory();

  return (
    <div className="page-wrapper">
      <div className="card" style={{ maxWidth: 300 }}>
        <h2>Current</h2>
        <div className="big">{current?.temp != null ? `${current.temp}°C` : "—"}</div>
        <div>{current?.humidity != null ? `${current.humidity}% humidity` : ""}</div>
      </div>

      <div className="card" style={{ height: "34vh" }}>
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
