"use client";

import { useEffect, useState } from "react";

// Port of CalendarTimeline.vue + CalendarTimeBlock.vue (merged into one file
// since the sub-component had no independent reuse elsewhere).

export type CalendarEvent = {
  id: string;
  name: string;
  date: string;
  colorId?: string | number | null;
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

function describeCountdown(dateStr: string) {
  const eventDate = new Date(dateStr);
  const now = new Date();

  if (eventDate <= now) return { text: "Now", days: 0 };

  const diffMs = eventDate.getTime() - now.getTime();
  const oneMin = 1000 * 60;
  const oneHour = oneMin * 60;
  const oneDay = oneHour * 24;
  const oneMonth = oneDay * 30;

  const minsLeft = Math.ceil(diffMs / oneMin);
  const hoursLeft = Math.ceil(diffMs / oneHour);
  const daysLeft = Math.ceil(diffMs / oneDay);
  const monthsLeft = Math.ceil((diffMs / oneMonth) * 10) / 10;

  let text = "";
  if (monthsLeft >= 1) text = `${monthsLeft} mth${monthsLeft > 1 ? "s" : ""}`;
  else if (daysLeft >= 2) text = `${daysLeft} days`;
  else if (hoursLeft < 24 && hoursLeft > 3) text = `${Math.round(diffMs / oneHour)} hours`;
  else if (hoursLeft <= 3 && hoursLeft >= 1) text = `${Math.round((diffMs / oneHour) * 10) / 10} hours`;
  else if (minsLeft < 60) text = `${Math.round(diffMs / oneMin)} min`;

  return { text, days: daysLeft };
}

function relevanceOpacity(days: number) {
  if (days <= 1) return "rgba(255,255,255,1)";
  if (days <= 7) return "rgba(255,255,255,0.7)";
  if (days <= 10) return "rgba(255,255,255,0.4)";
  return "rgba(255,255,255,0.15)";
}

function EventRow({ event }: { event: CalendarEvent }) {
  const [{ text, days }, setCountdown] = useState(() => describeCountdown(event.date));

  useEffect(() => {
    const id = setInterval(() => setCountdown(describeCountdown(event.date)), 2000);
    return () => clearInterval(id);
  }, [event.date]);

  return (
    <div className="event_wrapper">
      <div className="header" style={{ color: relevanceOpacity(days) }}>
        <h2 className="time_remain">{text}</h2>
        <div className="dot" style={{ backgroundColor: EVENT_COLORS[String(event.colorId)] ?? EVENT_COLORS.null }} />
        <h1>{event.name}</h1>
      </div>
    </div>
  );
}

export default function CalendarTimeline({ events }: { events: CalendarEvent[] }) {
  return (
    <div className="calendar_timeline_wrapper">
      <div className="event_list">
        {events.slice(0, 5).map((event) => (
          <EventRow event={event} key={event.id} />
        ))}
      </div>
    </div>
  );
}
