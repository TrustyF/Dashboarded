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

type Props = {
    weight: Point[];
    fat?: Point[];
};

// Replaces components/fitbit/WeightGraph.vue. BMI is still left off the chart
// (fetched only for the summary numbers, same as the original) - fat% plots
// alongside weight on its own axis, same dual-axis pattern as
// SensorHistoryChart's temp/humidity.
export default function WeightChart({weight, fat}: Props) {
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
                ],
                series: withEaseOutAnimation(withNoInteraction(series)),
            }}
        />
    );
}
