"use client";

import { useEffect, useRef, useState } from "react";

export type ImageLayer = { url: string; key: number };

// Feed this an already-loaded URL (see useDeferredImageUrl) - it keeps the
// previous one mounted underneath a newly-arriving one for `fadeMs`
// (matching page.module.sass's `fadeIn 1s` animation) instead of swapping
// DOM nodes outright. A single element keyed by URL gets destroyed and
// recreated the instant the URL changes, and there's a frame where neither
// the old nor new image is on screen - the black flash. Stacking two
// absolutely-positioned layers (old fully opaque underneath, new fading in
// on top via the existing fadeIn animation) keeps something opaque visible
// throughout the transition instead - a real crossfade.
export function useCrossfadeLayers(url: string | undefined, fadeMs = 1000): ImageLayer[] {
  const [layers, setLayers] = useState<ImageLayer[]>(() => (url ? [{ url, key: 0 }] : []));
  const nextKey = useRef(1);

  useEffect(() => {
    setLayers((prev) => {
      const top = prev[prev.length - 1];
      if (top?.url === url) return prev;
      if (!url) return [];
      return [...prev, { url, key: nextKey.current++ }];
    });
  }, [url]);

  useEffect(() => {
    if (layers.length <= 1) return;
    // A small margin past the CSS animation's own duration - setTimeout has
    // no guaranteed precision relative to when the browser actually paints
    // the animation's last frame, so pruning at exactly fadeMs risked
    // removing the old (opaque) layer a frame before the new one had
    // visually finished fading in, which read as a pop right at the end.
    const timer = setTimeout(() => {
      setLayers((prev) => (prev.length > 1 ? [prev[prev.length - 1]] : prev));
    }, fadeMs + 100);
    return () => clearTimeout(timer);
  }, [layers, fadeMs]);

  return layers;
}
