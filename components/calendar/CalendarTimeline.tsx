"use client";

import { useMemo } from "react";
import { useTick } from "@/lib/hooks";
import { EVENT_COLORS } from "@/lib/calendar-colors";
import styles from "./CalendarTimeline.module.sass";

// Port of CalendarTimeline.vue + CalendarTimeBlock.vue (merged into one file
// since the sub-component had no independent reuse elsewhere).

export type CalendarEvent = {
  id: string;
  name: string;
  date: string;
  colorId?: string | number | null;
  // Owning calendar's color, hex - fallback for events without their own
  // colorId override. See app/api/calendar/route.ts's getCalendarColor.
  calendarColor?: string;
  recurring?: boolean;
  allDay?: boolean;
};

const NO_COLOR = "rgb(128,128,128)";

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function describeCountdown(dateStr: string, allDay: boolean | undefined) {
  const eventDate = new Date(dateStr);
  const now = new Date();

  if (eventDate <= now) return { text: "Now", days: 0 };

  const calendarDaysUntil = Math.round((startOfDay(eventDate).getTime() - startOfDay(now).getTime()) / 86400000);
  const timeStr = eventDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  if (calendarDaysUntil === 0) return { text: allDay ? "Today" : timeStr, days: 0 };
  if (calendarDaysUntil === 1) return { text: allDay ? "Tomorrow" : `Tomorrow at ${timeStr}`, days: 1 };

  const oneDay = 1000 * 60 * 60 * 24;
  const oneMonth = oneDay * 30;
  const monthsLeft = Math.ceil(((eventDate.getTime() - now.getTime()) / oneMonth) * 10) / 10;

  const text = monthsLeft >= 1 ? `${monthsLeft} month${monthsLeft > 1 ? "s" : ""}` : `${calendarDaysUntil} days`;

  return { text, days: calendarDaysUntil };
}

function relevanceOpacity(days: number) {
  if (days <= 1) return "rgba(255,255,255,1)";
  if (days <= 7) return "rgba(255,255,255,0.8)";
  return "rgba(255,255,255,0.6)";
}

// Space between dots grows with the time gap to the next event, so a
// cluster of same-day events reads as tight and a jump to next month reads
// as a real jump. Square-root keeps the scale from blowing up over long gaps.
const MIN_GAP_EM = 0.5;
const MAX_GAP_EM = 20;
const GAP_EM_PER_SQRT_DAY = 2;

function gapEmForDayDelta(deltaDays: number) {
  const em = Math.sqrt(Math.max(deltaDays, 0)) * GAP_EM_PER_SQRT_DAY;
  return Math.min(MAX_GAP_EM, Math.max(MIN_GAP_EM, em));
}

function eventColor(event: CalendarEvent) {
  return EVENT_COLORS[String(event.colorId)] ?? event.calendarColor ?? NO_COLOR;
}

// Today's events skip the dot-and-line rail entirely - there's no "time until"
// left to show, so they read better as their own callout cards than as the
// start of a timeline that's really about the future.
function TodayCard({ event, text }: { event: CalendarEvent; text: string }) {
  const color = eventColor(event);

  return (
    <div className={styles.todayCard} style={{ "--accent": color } as React.CSSProperties}>
      <div className={styles.todayDot} style={{ background: color }} />
      <div className={styles.body}>
        <div className={styles.countdown}>{text}</div>
        <div className={styles.name}>
          {event.recurring && <i className={`bi bi-arrow-repeat ${styles.repeatIcon}`} aria-label="Recurring event" />}
          {event.name}
        </div>
      </div>
    </div>
  );
}

function EventRow({
  event,
  isLast,
  gapEm,
  text,
  days,
}: {
  event: CalendarEvent;
  isLast: boolean;
  gapEm: number;
  text: string;
  days: number;
}) {
  const color = eventColor(event);

  return (
    <div className={styles.row}>
      <div className={styles.rail}>
        <div className={styles.dot} style={{ background: color }} />
        {!isLast && <div className={styles.line} style={{ minHeight: `${gapEm}em` }} />}
      </div>
      <div className={styles.body} style={{ color: relevanceOpacity(days) }}>
        <div className={styles.countdown}>{text}</div>
        <div className={styles.name}>{event.name}</div>
      </div>
    </div>
  );
}

export default function CalendarTimeline({ events }: { events: CalendarEvent[] }) {
  // Nothing describeCountdown() produces (clock time, day count, the "Now"
  // flip) ever changes on a sub-minute basis, so there's no reason to
  // recheck more often than the displayed text could actually change.
  const tick = useTick(60_000);

  const { todayEvents, laterEvents, countdowns } = useMemo(() => {
    const shown = events.slice(0, 200);
    const countdowns = new Map(shown.map((e) => [e.id, describeCountdown(e.date, e.allDay)]));
    const todayEvents = shown.filter((e) => countdowns.get(e.id)!.days === 0);
    // Recurring events are only worth surfacing on the day they're actually
    // happening - a repeating series doesn't belong in the future timeline,
    // which is about distinct one-off things coming up.
    const laterEvents = shown.filter((e) => countdowns.get(e.id)!.days !== 0 && !e.recurring);
    return { todayEvents, laterEvents, countdowns };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick is a deliberate recompute trigger, not a data dependency
  }, [events, tick]);

  return (
    <div className={styles.wrapper}>
      {todayEvents.length > 0 && (
        <div className={styles.todaySection}>
          {todayEvents.map((event) => (
            <TodayCard event={event} text={countdowns.get(event.id)!.text} key={event.id} />
          ))}
        </div>
      )}

      <div className={styles.eventList}>
        {laterEvents.map((event, i) => {
          const next = laterEvents[i + 1];
          const gapEm = next
            ? gapEmForDayDelta(
                (new Date(next.date).getTime() - new Date(event.date).getTime()) / 86400000
              )
            : MIN_GAP_EM;
          const { text, days } = countdowns.get(event.id)!;

          return (
            <EventRow
              event={event}
              isLast={i === laterEvents.length - 1}
              gapEm={gapEm}
              text={text}
              days={days}
              key={event.id}
            />
          );
        })}
      </div>
    </div>
  );
}
