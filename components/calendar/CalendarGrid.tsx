"use client";

import { useEffect, useRef, useState } from "react";
import type { CalendarEvent } from "./CalendarTimeline";
import { EVENT_COLORS } from "@/lib/calendar-colors";
import { hexToRgba } from "@/lib/color";
import styles from "./CalendarGrid.module.sass";

type TooltipState = {
  date: Date;
  // Position relative to .gridArea (the nearest positioned ancestor), so it
  // stays anchored to the clicked cell regardless of scroll/layout - not
  // relative to the viewport, which the resize-driven cell size would fight.
  top: number;
  left: number;
};

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

function eventColorHex(event: CalendarEvent) {
  return EVENT_COLORS[String(event.colorId)] ?? event.calendarColor;
}

export default function CalendarGrid({ events }: { events: CalendarEvent[] }) {
  const today = new Date();
  const daysGrid = buildDaysGrid(today);
  const rows = daysGrid.length / 7;
  const { ref, cell } = useCellSize(rows);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  function eventsForDay(date: Date) {
    return events.filter((e) => sameDay(new Date(e.date), date));
  }

  function eventColorFor(date: Date) {
    const match = events.find((e) => sameDay(new Date(e.date), date));
    if (!match) return "transparent";
    const hex = eventColorHex(match);
    return hex ? hexToRgba(hex, 0.5) : NO_COLOR;
  }

  function handleDayClick(e: React.MouseEvent<HTMLDivElement>, date: Date) {
    if (tooltip && sameDay(tooltip.date, date)) {
      setTooltip(null);
      return;
    }
    if (eventsForDay(date).length === 0) {
      setTooltip(null);
      return;
    }

    const cellRect = e.currentTarget.getBoundingClientRect();
    const containerRect = ref.current!.getBoundingClientRect();
    setTooltip({
      date,
      top: cellRect.bottom - containerRect.top + 4,
      left: cellRect.left - containerRect.left,
    });
  }

  // Closes the tooltip on a tap/click anywhere outside it - mousedown (not
  // click) so it fires before a click on a different day cell, letting that
  // cell's own onClick still open its tooltip in the same tick rather than
  // this listener closing what the cell click just opened.
  useEffect(() => {
    if (!tooltip) return;

    function handlePointerDown(e: MouseEvent) {
      if (tooltipRef.current?.contains(e.target as Node)) return;
      setTooltip(null);
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [tooltip]);

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
                onClick={(e) => handleDayClick(e, date)}
              >
                {date.getDate()}
              </div>
            ))}
          </div>
        )}

        {tooltip && (
          <div
            ref={tooltipRef}
            className={styles.tooltip}
            style={{ top: tooltip.top, left: tooltip.left }}
          >
            <div className={styles.tooltipDate}>
              {tooltip.date.toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric" })}
            </div>
            {eventsForDay(tooltip.date).length === 0 && <div className={styles.tooltipEvent}>No events</div>}
            {eventsForDay(tooltip.date).map((event) => {
              const color = eventColorHex(event) ?? NO_COLOR;
              return (
                <div key={event.id} className={styles.tooltipEvent}>
                  <span className={styles.tooltipDot} style={{ background: color }} />
                  <span className={styles.tooltipName}>{event.name}</span>
                  <span className={styles.tooltipTime}>
                    {event.allDay
                      ? "All day"
                      : new Date(event.date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
