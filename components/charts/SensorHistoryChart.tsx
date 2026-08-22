"use client";

import ReactEChartsCore from "echarts-for-react/lib/core";
import {
  EASE_OUT_ANIMATION,
  echarts,
  NO_INTERACTION,
  THEME_NAME,
  useChartMountSettled,
  withEaseOutAnimation,
  withNoInteraction,
} from "@/lib/echarts-setup";
import { movingAverageNullable } from "@/lib/moving-average";

type Props = {
  times: string[];
  temp: (number | null)[];
  humidity: (number | null)[];
};

// poll.py samples the DHT22 every 10s (SENSOR_POLL_INTERVAL) into a
// 100-reading rolling window (SENSOR_HISTORY_LENGTH) - a 5-reading window
// here covers 50s either side of noise without smearing out real swings
// across that ~17-minute span.
const SMOOTHING_WINDOW_READINGS = 5;

// Replaces components/sensors/SensorTempGraph.vue - dual-axis temp/humidity
// line chart over the poller's rolling history.
export default function SensorHistoryChart({ times, temp, humidity }: Props) {
  // See lib/echarts-setup.ts - mounting before this card's layout has
  // settled is what caused DailyTempChart's container-resize/redraw bug.
  const settled = useChartMountSettled();
  const smoothTemp = movingAverageNullable(temp, SMOOTHING_WINDOW_READINGS);
  const smoothHumidity = movingAverageNullable(humidity, SMOOTHING_WINDOW_READINGS);

  if (!settled) return null;

  return (
    <ReactEChartsCore
      echarts={echarts}
      theme={THEME_NAME}
      style={{ height: "100%", width: "100%" }}
      option={{
        ...NO_INTERACTION,
        ...EASE_OUT_ANIMATION,
        // selectedMode: false - a legend's click-to-toggle-series is its own
        // bit of mouse interaction, independent of the tooltip suppression
        // above. Keep the color key visible, just not clickable.
        legend: { show: true, selectedMode: false },
        grid: { left: 50, right: 50, top: 16, bottom: 30 },
        xAxis: { type: "category", data: times },
        yAxis: [
          { type: "value", position: "left", axisLabel: { formatter: "{value}°" } },
          {
            type: "value",
            position: "right",
            splitLine: { show: false },
            axisLabel: { formatter: "{value}%" },
          },
        ],
        series: withEaseOutAnimation(
          withNoInteraction([
            {
              name: "Temp (°C)",
              type: "line",
              yAxisIndex: 0,
              data: smoothTemp,
              showSymbol: false,
              smooth: 0.3,
              connectNulls: true,
              color: "#e07a5f",
            },
            {
              name: "Humidity (%)",
              type: "line",
              yAxisIndex: 1,
              data: smoothHumidity,
              showSymbol: false,
              smooth: 0.3,
              connectNulls: true,
              color: "#5b9bd5",
            },
          ])
        ),
      }}
    />
  );
}
