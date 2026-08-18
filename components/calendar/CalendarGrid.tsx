import type { CalendarEvent } from "./CalendarTimeline";
import styles from "./CalendarGrid.module.sass";

// Port of CalendarGrid.vue - shows the current month, colors days that have
// an event, and outlines today.

const EVENT_COLORS: Record<string, string> = {
  null: "rgba(230,82,69,0.5)",
  "1": "rgba(82,102,204,0.5)",
  "2": "rgba(20,204,118,0.5)",
  "3": "rgba(149,68,171,0.5)",
  "4": "rgba(230,124,115,0.5)",
  "5": "rgba(245,189,37,0.5)",
  "6": "rgba(245,80,29,0.5)",
  "7": "rgba(2,154,230,0.5)",
  "8": "rgba(97,97,97,0.5)",
  "9": "rgba(63,81,181,0.5)",
  "10": "rgba(11,128,68,0.5)",
  "11": "rgba(214,43,43,0.5)",
};

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

export default function CalendarGrid({ events }: { events: CalendarEvent[] }) {
  const today = new Date();
  const daysGrid = buildDaysGrid(today);

  function eventColorFor(date: Date) {
    const match = events.find((e) => sameDay(new Date(e.date), date));
    return EVENT_COLORS[String(match?.colorId)] ?? "transparent";
  }

  return (
    <div className={styles.wrapper}>
      <h1>{today.toLocaleString("en-GB", { year: "numeric", month: "long", day: "2-digit" })}</h1>
      <div className={styles.grid}>
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
            style={{ background: eventColorFor(date) }}
          >
            {date.getDate()}
          </div>
        ))}
      </div>
    </div>
  );
}
