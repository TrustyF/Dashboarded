"use client";

import { useEffect, useState } from "react";
import styles from "./Clock.module.sass";

// Port of Clock.vue. The original also had a commented-out sunrise/sunset
// progress bar (dead code in the source) - not carried over.

export default function Clock({ size = 1 }: { size?: number }) {
  const [parts, setParts] = useState<{ time: string; decorator: string } | null>(null);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    function tick() {
      const [time, decorator] = new Date()
        .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        .split(" ");
      setParts({ time, decorator: decorator ?? "" });
      // Only the minute digits are ever displayed, so waking up once a
      // second (60x more often than the display can even change) just
      // burns idle CPU on a kiosk that's on 24/7. Re-align to the next
      // minute boundary each time instead of polling on a fixed interval.
      timeoutId = setTimeout(tick, 60_000 - (Date.now() % 60_000));
    }
    tick();
    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <div className={styles.wrapper}>
      <div className={styles.timeWrapper} style={{ "--size": size } as React.CSSProperties}>
        <h1 className={styles.head}>{parts?.time ?? "--:--"}</h1>
        {parts?.decorator && <h1 className={styles.decorator}>{parts.decorator}</h1>}
      </div>
    </div>
  );
}
