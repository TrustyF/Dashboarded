import { CircularGauge } from "@/components/common/CircularGauge";
import styles from "./StepRings.module.sass";

export const STEPS_GOAL = 10_000;

type Props = {
  days: Array<{ dateTime: string; value: number | null }>;
  color: string;
  goal?: number;
};

const SIZE = 60;
const STROKE = 12;
const TRACK_COLOR = "#23272c";
// Mirrors app/_variables.sass' $nav-transition-ms - the ring should start
// filling once the page has actually arrived, not underneath the still
// sliding-in page.
const NAV_TRANSITION_MS = 250;

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-US", { weekday: "short" });

// Google Fit style "close your ring" per-day activity indicator - one ring
// per day, filled proportionally to steps/goal. Past the goal, CircularGauge
// wraps into another lap (full ring + a soft shadow marking where the tip
// has swept to on the new lap) instead of capping at 100%.
export default function StepRings({ days, color, goal = STEPS_GOAL }: Props) {
  return (
    <div className={styles.row}>
      {days.map((day) => {
        const label = WEEKDAY_FORMATTER.format(new Date(`${day.dateTime}T00:00:00`));

        return (
          <div className={styles.ring} key={day.dateTime}>
            <CircularGauge
              value={day.value ?? 0}
              max={goal}
              size={SIZE}
              strokeWidth={STROKE}
              trackColor={TRACK_COLOR}
              color={color}
              showValue={false}
              animateOnMount
              animateDelayMs={NAV_TRANSITION_MS}
            />
            <span className={styles.dayLabel}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}
