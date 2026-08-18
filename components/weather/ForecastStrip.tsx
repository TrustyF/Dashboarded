import WeatherSummary, { CODE_MAP } from "./WeatherSummary";

// Port of ForecastStrip.vue - next few days' max temp + icon + condition name,
// stacked vertically (it's a "strip" next to the big current-conditions
// summary, not a horizontal row - matches the original's flex column).

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
    <div className="forecast_weather">
      {days.map((temp, i) => {
        const code = weatherCodes.slice(1, MAX_DAYS)[i];
        const [title] = CODE_MAP[code] ?? CODE_MAP[999];
        return (
          <div className="weather_strip" key={i}>
            <WeatherSummary size={0.5} subtitle={false} temperature={Math.round(temp)} weatherCode={code} />
            <h2 className="strip_subtitle">{title}</h2>
          </div>
        );
      })}
    </div>
  );
}
