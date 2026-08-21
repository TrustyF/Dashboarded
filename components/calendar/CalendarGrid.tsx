"use client";

import { useEffect, useRef, useState } from "react";
import type { CalendarEvent } from "./CalendarTimeline";
import { EVENT_COLORS } from "@/lib/calendar-colors";
import { hexToRgba } from "@/lib/color";
import styles from "./CalendarGrid.module.sass";

// Port of CalendarGrid.vue - shows the current month, colors days that have
// an event, and outlines today.

const NO_COLOR = "rgba(230,82,69,0.5)";

// Single source of truth for the gap between cells, in px - shared between
// the actual rendered gap and the cell-size math below, so the two can't
// drift out of sync the way a CSS gap and a separate calc() constant could.
const GAP = 4;

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isPast(date: Date, today: Date) {
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);
  const compare = new Date(date);
  compare.setHours(0, 0, 0, 0);
  return compare < d;
}

function buildDaysGrid(today: Date) {
  const year = today.getFullYear();
  const month = today.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const firstWeekday = (firstDayOfMonth + 6) % 7; // Monday = 0

  const prevMonthDays = Array.from({ length: firstWeekday }, (_, i) => ({
    date: new Date(year, month - 1, daysInPrevMonth - firstWeekday + i + 1),
    isNextMonth: false,
  }));

  const currentMonthDays = Array.from({ length: daysInMonth }, (_, i) => ({
    date: new Date(year, month, i + 1),
    isNextMonth: false,
  }));

  const totalSoFar = prevMonthDays.length + currentMonthDays.length;
  const remainder = totalSoFar % 7;
  const daysToAdd = remainder === 0 ? 0 : 7 - remainder;
  const nextMonthDays = Array.from({ length: daysToAdd + 7 }, (_, i) => ({
    date: new Date(year, month + 1, i + 1),
    isNextMonth: true,
  }));

  return [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];
}

// Measures .gridArea's actual rendered height and derives an exact
// per-cell pixel size from it (height / rows, gaps accounted for) - rather
// than leaning on CSS grid-track/aspect-ratio interactions to get there.
// A ResizeObserver reacts correctly to *any* cause of the box changing size
// (viewport resize, a sibling card's content changing, font load, ...)
// instead of only the specific cases a given CSS trick happens to cover,
// and the math is trivial to read back and verify compared to a
// multi-property CSS chain.
function useCellSize(rows: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [cell, setCell] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      const size = (entry.contentRect.height - (rows - 1) * GAP) / rows;
      setCell(Math.max(size, 0));
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [rows]);

  return { ref, cell };
}

export default function CalendarGrid({ events }: { events: CalendarEvent[] }) {
  const today = new Date();
  const daysGrid = buildDaysGrid(today);
  const rows = daysGrid.length / 7;
  const { ref, cell } = useCellSize(rows);

  function eventColorFor(date: Date) {
    const match = events.find((e) => sameDay(new Date(e.date), date));
    if (!match) return "transparent";
    const hex = EVENT_COLORS[String(match.colorId)] ?? match.calendarColor;
    return hex ? hexToRgba(hex, 0.5) : NO_COLOR;
  }

  return (
    <div className={styles.wrapper}>
      <h1>{today.toLocaleString("en-GB", { year: "numeric", month: "long", day: "2-digit" })}</h1>
      <div className={styles.gridArea} ref={ref}>
        {cell > 0 && (
          <div className={styles.grid} style={{ gap: GAP }}>
            {daysGrid.map(({ date, isNextMonth }) => (
              <div
                key={date.toISOString()}
                className={[
                  styles.day,
                  isNextMonth && styles.next,
                  sameDay(date, today) && styles.today,
                  isPast(date, today) && styles.past,
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ width: cell, height: cell, background: eventColorFor(date) }}
              >
                {date.getDate()}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
