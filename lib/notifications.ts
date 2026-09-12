"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCalendar, useFitbit, useTick, useWeather } from "@/lib/hooks";

export type Notification = {
  id: string;
  message: string;
  // Bootstrap Icons class, e.g. "bi-calendar-event" - same icon font already
  // used throughout Nav.tsx/nav-links.ts.
  icon: string;
  // How long this one stays on screen once shown, in ms - per-notification
  // rather than global so a source can ask for longer (e.g. something that
  // needs reading in full) without changing the default for everything
  // else. Defaults to DEFAULT_DISPLAY_MS.
  displayMs?: number;
  // Optional supporting detail shown alongside the message - e.g. an
  // appointment's start time, or how much rain is expected. Callers format
  // this themselves (a time string, "2.4mm", etc.) since sources have
  // nothing in common structurally beyond both wanting a headline figure.
  value?: string;
};

// A glance-and-move-on cadence for a wall-mounted kiosk, not something
// anyone's expected to dismiss by hand (though tapping one does dismiss it
// early - see NotificationTray.tsx). Same idea as Nav.tsx's own auto-hide pill.
const DEFAULT_DISPLAY_MS = 100_000;

// Independent of useCalendar's/useWeather's own network refresh intervals
// (1h and 5min respectively - see lib/hooks.ts) - both rules below are
// checking a live "how much time is left" condition against already-fetched
// data, which needs to be rechecked far more often than the data itself
// changes.
const CHECK_INTERVAL_MS = 30_000;

// Reminds once an event's start time first crosses inside this lead window -
// a single heads-up, not a recurring nag for as long as it stays under it.
const CALENDAR_LEAD_MS = 65 * 60_000; // 1h05m

const RAIN_WINDOW_MS = 2 * 60 * 60_000; // 2h
const RAIN_PROBABILITY_THRESHOLD = 50; // percent

// 10,000 mirrors StepRings.tsx's own STEPS_GOAL (kept as its own literal
// here rather than imported - a lib importing a display component just for
// one shared constant isn't worth the layering it'd introduce, and "10k
// steps a day" is stable enough not to drift out of sync in practice).
const STEP_MILESTONES: { threshold: number; message: string; icon: string }[] = [
  { threshold: 5_000, message: "Halfway to your step goal", icon: "bi-star-fill" },
  { threshold: 10_000, message: "Daily step goal reached", icon: "bi-trophy-fill" },
];

// Fires `push` once per event, right as it crosses CALENDAR_LEAD_MS out -
// never retroactively for events already inside the window when the
// dashboard boots/reloads (that first tick just records them as "seen").
function useCalendarReminders(push: (n: Notification) => void) {
  const { data: events } = useCalendar();
  const notified = useRef<Set<string>>(new Set());
  const initialized = useRef(false);
  const tick = useTick(CHECK_INTERVAL_MS);

  useEffect(() => {
    if (!events) return;
    const now = Date.now();

    if (!initialized.current) {
      initialized.current = true;
      for (const event of events) {
        if (!event.allDay && new Date(event.date).getTime() - now <= CALENDAR_LEAD_MS) {
          notified.current.add(event.id);
        }
      }
      return;
    }

    for (const event of events) {
      if (event.allDay || notified.current.has(event.id)) continue;
      const remaining = new Date(event.date).getTime() - now;
      if (remaining > 0 && remaining <= CALENDAR_LEAD_MS) {
        notified.current.add(event.id);
        push({
          id: `calendar-${event.id}`,
          message: `"${event.name}" starts in about an hour`,
          icon: "bi-calendar-event",
          value: new Date(event.date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        });
      }
    }
  }, [events, tick, push]);
}

// Fires `push` once when the forecast newly clears the rain threshold
// somewhere in the next RAIN_WINDOW_MS - edge-triggered like the Spotify
// session-start switch in app/spotify/SpotifyView.tsx, so one long rainy
// stretch produces one banner, not a fresh one every recheck.
function useRainAlerts(push: (n: Notification) => void) {
  const { data: weather } = useWeather();
  const wasRainy = useRef(false);
  const tick = useTick(CHECK_INTERVAL_MS);

  useEffect(() => {
    const hourly = weather?.hourly;
    if (!hourly?.time) return;

    const now = Date.now();
    const horizon = now + RAIN_WINDOW_MS;
    let rainComing = false;
    let totalMm = 0;

    (hourly.time as string[]).forEach((t, i) => {
      const at = new Date(t).getTime();
      if (at < now || at > horizon) return;
      const probability = hourly.precipitation_probability?.[i] ?? 0;
      const amount = hourly.precipitation?.[i] ?? 0;
      totalMm += amount;
      if (probability >= RAIN_PROBABILITY_THRESHOLD || amount > 0.1) rainComing = true;
    });

    if (rainComing && !wasRainy.current) {
      push({
        id: `rain-${now}`,
        message: "Rain expected in the next 2 hours",
        icon: "bi-cloud-rain",
        value: `${totalMm.toFixed(1)}mm`,
      });
    }
    wasRainy.current = rainComing;
  }, [weather, tick, push]);
}

// Fires `push` once per threshold, the moment today's step count first
// crosses it - not a recurring nag for the rest of the day once past it.
// Thresholds (and the "already handled" baseline) reset whenever the
// tracked date rolls over, so the same two milestones can fire again
// tomorrow.
function useStepMilestones(push: (n: Notification) => void) {
  const { data: fitbit } = useFitbit();
  const state = useRef<{ date: string | null; hit: Set<number>; baselined: boolean }>({
    date: null,
    hit: new Set(),
    baselined: false,
  });

  useEffect(() => {
    const today = fitbit?.steps?.at(-1);
    if (!today) return;

    if (state.current.date !== today.dateTime) {
      state.current = { date: today.dateTime, hit: new Set(), baselined: false };
    }

    const value = today.value ?? 0;

    if (!state.current.baselined) {
      // Baseline whatever's already been hit today as "already handled" -
      // otherwise opening the dashboard mid-afternoon with 6,000 steps
      // already in would immediately fire the halfway milestone.
      state.current.baselined = true;
      for (const { threshold } of STEP_MILESTONES) {
        if (value >= threshold) state.current.hit.add(threshold);
      }
      return;
    }

    for (const { threshold, message, icon } of STEP_MILESTONES) {
      if (value >= threshold && !state.current.hit.has(threshold)) {
        state.current.hit.add(threshold);
        push({ id: `steps-${today.dateTime}-${threshold}`, message, icon, value: `${value.toLocaleString()} steps` });
      }
    }
  }, [fitbit, push]);
}

// The generic half of the system: owns display/expiry of whatever the rule
// hooks above push, with no knowledge of calendars or weather itself. Adding
// a new notification source later means writing one more useXAlerts(push)
// hook and calling it here - not touching this display logic.
export function useNotificationCenter(): {
  active: Notification[];
  dismiss: (id: string) => void;
  push: (n: Notification) => void;
} {
  const [active, setActive] = useState<Notification[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setActive((prev) => prev.filter((n) => n.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback((n: Notification) => {
    setActive((prev) => (prev.some((existing) => existing.id === n.id) ? prev : [...prev, n]));
    timers.current.set(
      n.id,
      setTimeout(() => {
        setActive((prev) => prev.filter((existing) => existing.id !== n.id));
        timers.current.delete(n.id);
      }, n.displayMs ?? DEFAULT_DISPLAY_MS)
    );
  }, []);

  // Clears any pending auto-dismiss timers on unmount - this hook only ever
  // mounts once at the layout root (see NotificationTray.tsx), so in
  // practice that's app teardown, but it's a real leak otherwise.
  useEffect(() => {
    const timersMap = timers.current;
    return () => timersMap.forEach((timer) => clearTimeout(timer));
  }, []);

  useCalendarReminders(push);
  useRainAlerts(push);
  useStepMilestones(push);

  return { active, dismiss, push };
}
