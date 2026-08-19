"use client";

import { useState } from "react";
import { useBrightness } from "@/lib/hooks";
import styles from "./page.module.sass";

// Kiosk-local settings - controls for things the Pi itself exposes (currently
// just screen brightness, via the brightnessctl-backed
// /api/settings/toggle-brightness route). Structured as a list of setting
// rows so more can be added later without reshaping the page.

export default function SettingsPage() {
  const { data, mutate } = useBrightness();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function cycleBrightness() {
    setPending(true);
    setError(false);
    try {
      const res = await fetch("/api/settings/toggle-brightness?toggle=toggle");
      if (!res.ok) throw new Error();
      await mutate();
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Settings</h1>

      <div className={styles.row}>
        <i className={`bi bi-brightness-high ${styles.rowIcon}`} />
        <div className={styles.rowLabel}>Screen brightness</div>
        <button className={styles.rowAction} onClick={cycleBrightness} disabled={pending}>
          {data?.brightness != null ? `${data.brightness}%` : "—"}
        </button>
      </div>
      {error && <p className={styles.error}>Couldn&apos;t change brightness - is brightnessctl available?</p>}
    </div>
  );
}
