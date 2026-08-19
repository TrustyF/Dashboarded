"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Mirrors the refresh cadence of the old Pinia stores (weather_store.js polled
// every 60s client-side against a 30 min server cache; calendar_store.js
// polled every 60 min).

export function useWeather() {
  return useSWR("/api/weather", fetcher, { refreshInterval: 5 * 60_000 });
}

export function useCalendar(limit = 100) {
  return useSWR(`/api/calendar?limit=${limit}`, fetcher, { refreshInterval: 60 * 60_000 });
}

export function useSensorCurrent() {
  return useSWR("/api/sensors/current", fetcher, { refreshInterval: 10_000 });
}

export function useSensorHistory() {
  return useSWR("/api/sensors", fetcher, { refreshInterval: 10_000 });
}

export function useFitbit(timeDelta = 300) {
  return useSWR(`/api/fitbit?time_delta=${timeDelta}`, fetcher, { refreshInterval: 60 * 60_000 });
}

export function useVitals() {
  return useSWR("/api/vitals", fetcher, { refreshInterval: 10_000 });
}

export function useBrightness() {
  return useSWR("/api/settings/toggle-brightness?toggle=state", fetcher);
}
