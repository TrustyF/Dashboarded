"use client";

import { useEffect, useState } from "react";
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

const EVENT_COLORS: Record<string, string> = {
  null: "rgb(128,128,128)",
  "1": "#5266cc",
  "2": "#33B679",
  "3": "#9544ab",
  "4": "#e65245",
  "5": "#F6BF26",
  "6": "#F4511E",
  "7": "#039BE5",
  "8": "#616161",
  "9": "#3F51B5",
  "10": "#0B8043",
  "11": "#d62b2b",
};

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

  const text = monthsLeft >= 1 ? `${monthsLeft} mth${monthsLeft > 1 ? "s" : ""}` : `${calendarDaysUntil} days`;

  return { text, days: calendarDaysUntil };
}

function relevanceOpacity(days: number) {
  if (days <= 1) return "rgba(255,255,255,1)";
  if (days <= 7) return "rgba(255,255,255,0.7)";
  if (days <= 10) return "rgba(255,255,255,0.4)";
  return "rgba(255,255,255,0.15)";
}

function EventRow({ event, isLast }: { event: CalendarEvent; isLast: boolean }) {
  const [{ text, days }, setCountdown] = useState(() => describeCountdown(event.date, event.allDay));

  useEffect(() => {
    const id = setInterval(() => setCountdown(describeCountdown(event.date, event.allDay)), 2000);
    return () => clearInterval(id);
  }, [event.date, event.allDay]);

  const color = EVENT_COLORS[String(event.colorId)] ?? event.calendarColor ?? EVENT_COLORS.null;

  return (
    <div className={styles.row}>
      <div className={styles.rail}>
        <div className={styles.dot} style={{ background: color }} />
        {!isLast && <div className={styles.line} />}
      </div>
      <div className={styles.body} style={{ color: relevanceOpacity(days) }}>
        <div className={styles.countdown}>{text}</div>
        <div className={styles.name}>
          {event.recurring && <i className={`bi bi-arrow-repeat ${styles.repeatIcon}`} aria-label="Recurring event" />}
          {event.name}
        </div>
      </div>
    </div>
  );
}

export default function CalendarTimeline({ events }: { events: CalendarEvent[] }) {
  const shown = events.slice(0, 5);

  return (
    <div className={styles.eventList}>
      {shown.map((event, i) => (
        <EventRow event={event} isLast={i === shown.length - 1} key={event.id} />
      ))}
    </div>
  );
}
