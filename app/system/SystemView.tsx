"use client";

import { useSensorHistory, useVitals, useVitalsHistory } from "@/lib/hooks";
import { netChange } from "@/lib/weather-metrics";
import StatCard from "@/components/stats/StatCard";
import { STAT_COLORS } from "@/lib/stat-colors";
import styles from "./SystemView.module.sass";

// Same Google Fit/Health Connect style overview as app/weather/WeatherView.tsx and
// app/health/HealthView.tsx: quick-glance stat tiles, each with its own sparkline
// trend - was a bespoke chart-per-card layout, brought back in line with
// that shared pattern. Built after diagnosing a flaky PSU by hand (Aug 22)
// via repeated `vcgencmd`/`dmesg` polling over SSH - the under-voltage tile
// is what would have caught it on-screen instead. (Clock/under-voltage are
// read from sysfs, not vcgencmd - see lib/vitals-sampler.ts for why.)

const STALE_AFTER_MS = 30_000;

function formatAgo(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

export default function SystemView() {
  const { data: vitals } = useVitals();
  const { data: history, isLoading } = useVitalsHistory();
  const { data: sensorHistory } = useSensorHistory();

  const lastReadingTime = sensorHistory?.time?.at(-1);
  const heartbeatAgeMs = lastReadingTime ? Date.now() - new Date(lastReadingTime).getTime() : null;
  const heartbeatStale = heartbeatAgeMs != null && heartbeatAgeMs > STALE_AFTER_MS;

  const underVoltageCount = history?.underVoltageNow?.filter(Boolean).length ?? 0;

  return (
    <div className={styles.wrapper}>
      {isLoading || !history?.time?.length ? (
        <p>Waiting for readings…</p>
      ) : (
        <div className={styles.statGrid}>
          <StatCard
            label="Temp"
            value={history.tempC.at(-1) ?? null}
            unit="°"
            diff={netChange(history.tempC)}
            color={STAT_COLORS.deviceTemp}
            sparkline={history.tempC}
            goodDirection="down"
          />
          <StatCard
            label="Clock"
            value={history.armClockMhz.at(-1) ?? null}
            unit="MHz"
            diff={netChange(history.armClockMhz)}
            color={STAT_COLORS.clock}
            sparkline={history.armClockMhz}
            goodDirection="neutral"
          />
          <StatCard
            label="CPU"
            value={history.cpuPercent.at(-1) ?? null}
            unit="%"
            diff={netChange(history.cpuPercent)}
            color={STAT_COLORS.cpu}
            sparkline={history.cpuPercent}
            goodDirection="neutral"
          />
          <StatCard
            label="RAM"
            value={history.ramPercent.at(-1) ?? null}
            unit="%"
            diff={netChange(history.ramPercent)}
            color={STAT_COLORS.ram}
            sparkline={history.ramPercent}
            goodDirection="neutral"
          />
          <StatCard
            label="Under-voltage"
            value={underVoltageCount}
            unit=""
            diff={null}
            color={STAT_COLORS.undervoltage}
            sparkline={history.underVoltageNow.map((v: boolean) => (v ? 1 : 0))}
            sparklineMin={0}
            sparklineMax={1}
            goodDirection="down"
          />
        </div>
      )}

      <div className={styles.stats}>
        <div className={styles.stat}>
          <i className={`bi bi-clock-history ${styles.statIcon}`} />
          <span className={styles.statLabel}>Uptime</span>
          <span>{vitals?.uptime ?? "—"}</span>
        </div>

        <div className={styles.stat}>
          <i className={`bi bi-hdd-network ${styles.statIcon}`} />
          <span className={styles.statLabel}>IP</span>
          <span>{vitals?.ip ?? "—"}</span>
        </div>

        <div className={styles.stat}>
          <i className={`bi bi-device-hdd ${styles.statIcon}`} />
          <span className={styles.statLabel}>Disk</span>
          <span>{vitals?.diskUsedPercent != null ? `${vitals.diskUsedPercent}%` : "—"}</span>
        </div>

        <div className={styles.stat}>
          <i className={`bi bi-broadcast ${styles.statIcon}`} />
          <span className={styles.statLabel}>Sensors</span>
          <span className={heartbeatStale ? styles.stale : undefined}>
            {heartbeatAgeMs != null ? formatAgo(heartbeatAgeMs) : "no data"}
          </span>
        </div>
      </div>
    </div>
  );
}
