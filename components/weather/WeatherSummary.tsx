import TemperatureSingleton from "./TemperatureSingleton";

// Port of weather_summary.vue. Icon set carried over from the original
// dashboard_client/public/assets/weather/icons/v1.

export const CODE_MAP: Record<number, [title: string, icon: string]> = {
  999: ["", "undefined"],
  0: ["Clear sky", "sunny"],
  1: ["Mainly clear", "sunny_s_cloudy"],
  2: ["Partly cloudy", "partly_cloudy"],
  3: ["Overcast", "cloudy"],
  45: ["Fog", "fog"],
  48: ["Rime fog", "fog"],
  51: ["Light drizzle", "rain_light"],
  53: ["Moderate drizzle", "rain_light"],
  55: ["Dense drizzle", "rain_light"],
  56: ["Light freezing drizzle", "rain_light"],
  57: ["Dense freezing drizzle", "rain_light"],
  61: ["Slight rain", "rain_light"],
  63: ["Moderate rain", "rain"],
  65: ["Heavy rain", "rain_heavy"],
  66: ["Light freezing rain", "rain_s_snow"],
  67: ["Heavy freezing rain", "rain_s_snow"],
  71: ["Slight snow fall", "snow_light"],
  73: ["Moderate snow fall", "snow"],
  75: ["Heavy snow fall", "snow_heavy"],
  77: ["Snow grains", "snow"],
  80: ["Slight rain showers", "rain_light"],
  81: ["Moderate rain showers", "rain"],
  82: ["Violent rain showers", "rain_heavy"],
  85: ["Slight snow showers", "snow_light"],
  86: ["Heavy snow showers", "snow_heavy"],
  95: ["Slight thunderstorm", "thunderstorms"],
};

export default function WeatherSummary({
  size = 1,
  temperature,
  weatherCode = 999,
  subtitle = true,
}: {
  size?: number;
  temperature: number;
  weatherCode?: number;
  subtitle?: boolean;
}) {
  const [title, icon] = CODE_MAP[weatherCode] ?? CODE_MAP[999];

  return (
    <div className="weather_summary_wrapper" style={{ "--size": size } as React.CSSProperties}>
      <div className="header">
        {icon !== "undefined" && (
          <img className="weather_icon" src={`/assets/weather/icons/v1/${icon}.png`} alt={title} />
        )}
        <TemperatureSingleton temperature={temperature} size={size} />
      </div>

      {subtitle && (
        <div className="footer">
          <h2 className="subtitle">{title}</h2>
        </div>
      )}
    </div>
  );
}
