"use client";

import { useEffect, useState } from "react";

// Port of Clock.vue. The original also had a commented-out sunrise/sunset
// progress bar (dead code in the source) - not carried over.

export default function Clock({ size = 1 }: { size?: number }) {
  const [parts, setParts] = useState<{ time: string; decorator: string } | null>(null);

  useEffect(() => {
    function tick() {
      const [time, decorator] = new Date()
        .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        .split(" ");
      setParts({ time, decorator: decorator ?? "" });
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="clock_wrapper">
      <div className="time_wrapper" style={{ "--size": size } as React.CSSProperties}>
        <h1 className="head">{parts?.time ?? "--:--"}</h1>
        {parts?.decorator && <h1 className="decorator">{parts.decorator}</h1>}
      </div>
    </div>
  );
}
