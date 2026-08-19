"use client";

import { useEffect, useState } from "react";
import { useCalendar, useSensorHistory, useVitals, useWeather } from "@/lib/hooks";
import Clock from "@/components/clock/Clock";
import WeatherSummary from "@/components/weather/WeatherSummary";
import StatChip from "@/components/StatChip";
import CalendarTimeline from "@/components/calendar/CalendarTimeline";
import styles from "./page.module.sass";

// A second take on the home screen: denser and more "smart-display" than the
// original's spartan clock/weather/calendar layout - clock+date and weather
// up top, a strip of live environment/device readouts (room temp+humidity
// from the sensor, CPU/RAM from vitals) in the middle, and the next few
// calendar events at the bottom.

function useDateString() {
  const [date, setDate] = useState("");
  useEffect(() => {
    function update() {
      setDate(new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }));
    }
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);
  return date;
}

export default function Home2Page() {
  const { data: weather } = useWeather();
  const { data: events } = useCalendar();
  const { data: sensorHistory } = useSensorHistory();
  const { data: vitals } = useVitals();
  const date = useDateString();

  const currentTemp = weather?.current?.temperature_2m;
  const sensorTemp = sensorHistory?.temp?.at(-1);
  const sensorHumidity = sensorHistory?.humidity?.at(-1);

  return (
    <div className={styles.wrapper}>
      <div className={styles.top}>
        <div className={styles.clockBlock}>
          <Clock size={0.9} />
          <div className={styles.date}>{date}</div>
        </div>

        <WeatherSummary
          size={0.9}
          temperature={currentTemp != null ? Math.round(currentTemp) : 0}
          weatherCode={weather?.current?.weather_code}
        />
      </div>

      <div className={styles.stats}>
        <StatChip icon="bi-thermometer-half" value={sensorTemp ?? "—"} unit="°C" label="Room" />
        <StatChip icon="bi-droplet-half" value={sensorHumidity ?? "—"} unit="%" label="Humidity" />
        <StatChip icon="bi-cpu" value={vitals?.cpu ?? "—"} unit="%" label="CPU" />
        <StatChip icon="bi-nvme" value={vitals?.ram ?? "—"} unit="%" label="RAM" />
      </div>

      <div className={styles.agenda}>
        <p className={styles.agendaHeading}>Upcoming</p>
        <CalendarTimeline events={(events ?? []).slice(0, 3)} />
      </div>
    </div>
  );
}
