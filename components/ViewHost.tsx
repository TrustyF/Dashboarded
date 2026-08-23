"use client";

import { useEffect, useState } from "react";
import { LINKS } from "@/lib/nav-links";
import { useActiveView } from "@/lib/active-view";
import HomeView from "@/app/HomeView";
import WeatherView from "@/app/weather/WeatherView";
import SpotifyView from "@/app/spotify/SpotifyView";
import HealthView from "@/app/health/HealthView";
import SensorsView from "@/app/sensors/SensorsView";
import SystemView from "@/app/system/SystemView";
import SettingsView from "@/app/settings/SettingsView";

const VIEWS: Record<string, React.ComponentType> = {
  "/": HomeView,
  "/weather": WeatherView,
  "/spotify": SpotifyView,
  "/health": HealthView,
  "/sensors": SensorsView,
  "/system": SystemView,
  "/settings": SettingsView,
};

// Mounted once at the layout root. Every view mounts at most once and is
// then kept alive forever, shown/hidden instead of unmounted/remounted, so
// switching views is never more than a visibility toggle - see the "Keep
// views mounted across navigation" plan for why (Nav's swipe/tap used to go
// through next/navigation's router, which unmounts the outgoing route's
// whole component tree on every switch).
export default function ViewHost() {
  const { activeHref } = useActiveView();

  const [mountedHrefs, setMountedHrefs] = useState<Set<string>>(() => new Set([activeHref]));

  // Render-phase adjustment (not a useEffect) so a switch to a view that
  // isn't mounted yet - possible in the brief window before the idle
  // callback below fires - mounts it immediately with no blank frame: React
  // discards and retries this render with the new state before anything
  // paints.
  if (!mountedHrefs.has(activeHref)) {
    setMountedHrefs((prev) => new Set(prev).add(activeHref));
  }

  // Same idle-then-load pattern the old components/AppPrefetch.tsx used for
  // warming data/code ahead of a first visit - now it mounts the real views
  // instead, which does everything that preloading did (and more directly),
  // so that component was retired in favor of this.
  useEffect(() => {
    const schedule = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1000));
    const cancel = window.cancelIdleCallback ?? clearTimeout;
    const id = schedule(() => setMountedHrefs(new Set(LINKS.map((link) => link.href))));
    return () => cancel(id as never);
  }, []);

  return (
    <>
      {LINKS.map((link) => {
        if (!mountedHrefs.has(link.href)) return null;
        const View = VIEWS[link.href];
        return (
          <div key={link.href} hidden={link.href !== activeHref}>
            <View />
          </div>
        );
      })}
    </>
  );
}
