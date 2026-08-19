import WeatherSummary, { CODE_MAP } from "./WeatherSummary";
import styles from "./ForecastStrip.module.sass";

// Port of ForecastStrip.vue - next few days' max temp + icon + condition name.
// Laid out as a horizontal row of compact day-cells (rather than the
// original's vertical stack next to the big current-conditions summary) so it
// fits as a slim fixed-height strip on the kiosk's 1280x720, no-scroll page.

const MAX_DAYS = 5;

export default function ForecastStrip({
  maxTemps,
  weatherCodes,
}: {
  maxTemps: number[];
  weatherCodes: number[];
}) {
  const days = maxTemps.slice(1, MAX_DAYS);

  return (
    <div className={styles.list}>
      {days.map((temp, i) => {
        const code = weatherCodes.slice(1, MAX_DAYS)[i];
        const [title] = CODE_MAP[code] ?? CODE_MAP[999];
        return (
          <div className={styles.row} key={i}>
            <WeatherSummary size={0.32} subtitle={false} temperature={Math.round(temp)} weatherCode={code} />
            <h2 className={styles.subtitle}>{title}</h2>
          </div>
        );
      })}
    </div>
  );
}
