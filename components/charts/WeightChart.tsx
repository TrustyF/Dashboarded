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

type Point = { dateTime: string; value: number | null };

// Raw daily steps swing too hard (a rest day next to a hiking day) for
// curve smoothing (`smooth: 0.3`) alone to read as a trend - that only
// rounds the corners of the same jagged path. A trailing average flattens
// the day-to-day noise into an actual trend line first.
const STEPS_SMOOTHING_WINDOW = 7;

function movingAverage(points: Point[], window: number): Point[] {
    return points.map((p, i) => {
        const slice = points.slice(Math.max(0, i - window + 1), i + 1);
        const values = slice.map((s) => s.value).filter((v): v is number => v != null);
        const avg = values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
        return { dateTime: p.dateTime, value: avg };
    });
}

type Props = {
    weight: Point[];
    fat?: Point[];
    steps?: Point[];
};

// Replaces components/fitbit/WeightGraph.vue. BMI is still left off the chart
// (fetched only for the summary numbers, same as the original) - fat% plots
// alongside weight on its own axis, same dual-axis pattern as
// SensorHistoryChart's temp/humidity. Steps get a third axis (own scale,
// capped well above real step counts) since step counts are orders of
// magnitude bigger than weight/fat and would flatten those lines if shared.
export default function WeightChart({weight, fat, steps}: Props) {
    // See lib/echarts-setup.ts - mounting before this card's flex layout has
    // settled is what caused DailyTempChart's container-resize/redraw bug.
    const settled = useChartMountSettled();
    if (!settled) return null;

    const series: Record<string, unknown>[] = [
        {
            name: "Weight (kg)",
            type: "line",
            yAxisIndex: 0,
            data: weight.map((p) => [p.dateTime, p.value]),
            showSymbol: false,
            smooth: 0.3,
            connectNulls: true,
            areaStyle: {opacity: 0.15},
            color: "#81b29a",
            endLabel: {show: true, formatter: "{a}", color: "#81b29a"},
        },
    ];

    if (fat) {
        series.push({
            name: "Fat (%)",
            type: "line",
            yAxisIndex: 1,
            data: fat.map((p) => [p.dateTime, p.value]),
            showSymbol: false,
            smooth: 0.3,
            connectNulls: true,
            color: "#e07a5f",
            endLabel: {show: true, formatter: "{a}", color: "#e07a5f"},
        });
    }

    if (steps) {
        series.push({
            name: "Steps",
            type: "line",
            yAxisIndex: 2,
            data: movingAverage(steps, STEPS_SMOOTHING_WINDOW).map((p) => [p.dateTime, p.value]),
            showSymbol: false,
            smooth: 0.3,
            color: "#f2cc8f",
            endLabel: {show: true, formatter: "{a}", color: "#f2cc8f"},
        });
    }

    return (
        <ReactEChartsCore
            echarts={echarts}
            theme={THEME_NAME}
            style={{height: "100%", width: "100%"}}
            option={{
                ...NO_INTERACTION,
                ...EASE_OUT_ANIMATION,
                grid: {left: 50, right: fat ? 110 : 80, top: 16, bottom: 30},
                xAxis: {type: "time"},
                yAxis: [
                    {type: "value", position: "left", min: 75, max: 90, axisLabel: {formatter: "{value}kg"}},
                    {
                        type: "value",
                        position: "right",
                        show: Boolean(fat),
                        min: 20,
                        max: 30,
                        splitLine: {show: true},
                        axisLabel: {show: false, formatter: "{value}%"},
                    },
                    {
                        type: "value",
                        position: "right",
                        show: false,
                        min: 0,
                        // 4x the daily goal keeps step bars confined to the
                        // bottom quarter of the chart, as a baseline layer
                        // rather than something competing with the lines.
                        max: 40_000,
                        splitLine: {show: false},
                        axisLabel: {show: false, formatter: "{value} steps"},
                    },
                ],
                series: withEaseOutAnimation(withNoInteraction(series)),
            }}
        />
    );
}
