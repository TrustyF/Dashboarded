import styles from "./StepRings.module.sass";

export const STEPS_GOAL = 10_000;

type Props = {
  days: Array<{ dateTime: string; value: number | null }>;
  color: string;
  goal?: number;
};

const SIZE = 60;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-US", { weekday: "short" });

// Google Fit style "close your ring" per-day activity indicator - one ring
// per day, filled proportionally to steps/goal (capped at a full circle).
export default function StepRings({ days, color, goal = STEPS_GOAL }: Props) {
  return (
    <div className={styles.row}>
      {days.map((day) => {
        const pct = Math.min((day.value ?? 0) / goal, 1);
        const label = WEEKDAY_FORMATTER.format(new Date(`${day.dateTime}T00:00:00`));

        return (
          <div className={styles.ring} key={day.dateTime}>
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
              <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="#23272c" strokeWidth={STROKE} />
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={color}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={CIRCUMFERENCE * (1 - pct)}
                transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              />
            </svg>
            <span className={styles.dayLabel}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}
