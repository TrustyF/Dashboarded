"use client";

import { useSensorHistory, useVitals } from "@/lib/hooks";
import styles from "./page.module.sass";

// New page - device vitals (temp/voltage/CPU%/RAM%, matching the original's
// never-wired-up vitals_container.vue) plus system/network status the
// original didn't have: uptime, IP, disk usage, and sensor_poller's last
// heartbeat (derived from the sensor history's most recent timestamp - if
// that goes stale, it usually means poll.py has stopped writing).

const STALE_AFTER_MS = 30_000;

function formatAgo(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

export default function SystemPage() {
  const { data: vitals } = useVitals();
  const { data: sensorHistory } = useSensorHistory();

  const lastReadingTime = sensorHistory?.time?.at(-1);
  const heartbeatAgeMs = lastReadingTime ? Date.now() - new Date(lastReadingTime).getTime() : null;
  const heartbeatStale = heartbeatAgeMs != null && heartbeatAgeMs > STALE_AFTER_MS;

  return (
    <div className={styles.wrapper}>
      <div className={styles.vitals}>
        <div className={styles.tile}>
          <div className={styles.tileValue}>{vitals?.temp ?? "—"}</div>
          <i className={`bi bi-thermometer ${styles.tileIcon}`} />
        </div>

        <div className={styles.tile}>
          <div className={styles.tileValue}>{vitals?.power ?? "—"}</div>
          <i className={`bi bi-lightning-charge-fill ${styles.tileIcon}`} />
        </div>

        <div className={styles.tile}>
          <div className={styles.tileValue}>{vitals?.cpu ?? "—"}</div>
          <div className={styles.tileDecorator}>%</div>
          <i className={`bi bi-cpu ${styles.tileIcon}`} />
        </div>

        <div className={styles.tile}>
          <div className={styles.tileValue}>{vitals?.ram ?? "—"}</div>
          <div className={styles.tileDecorator}>%</div>
          <i className={`bi bi-nvme ${styles.tileIcon}`} style={{ transform: "rotate(90deg)" }} />
        </div>
      </div>

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
