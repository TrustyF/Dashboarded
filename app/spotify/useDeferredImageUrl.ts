"use client";

import { useEffect, useState } from "react";

// Holds the previous URL on screen until the new one has actually finished
// downloading, instead of swapping (and fading in via .bgImg/.poster's
// fadeIn animation) the moment a new track's art URL is known - without
// this, the fade plays out against a still-loading/blank image and the
// real art just pops in whenever it happens to arrive.
export function useDeferredImageUrl(url: string | undefined): string | undefined {
  const [displayed, setDisplayed] = useState(url);

  useEffect(() => {
    if (url === displayed) return;

    if (!url) {
      setDisplayed(undefined);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setDisplayed(url);
    };
    // Broken/unreachable art shouldn't get stuck showing stale art forever.
    img.onerror = () => {
      if (!cancelled) setDisplayed(url);
    };
    img.src = url;

    return () => {
      cancelled = true;
    };
  }, [url, displayed]);

  return displayed;
}
