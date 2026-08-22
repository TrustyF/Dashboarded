"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

// Used to wrap navigation in the native View Transitions API for a slide
// animation (see git history for the old lib/view-transition-nav.ts).
// Measured via Chrome DevTools Protocol against the actual kiosk Chromium on
// the Pi 4: the animation's `.finished` promise took 390ms-1.3s in practice
// despite a 250ms CSS duration - full-viewport screenshot capture and
// compositing is too expensive for the Pi's GPU to hit that budget. React's
// own mount work for the new page was consistently fast (64-182ms) - the
// transition itself was the bottleneck, not app code - so it's dropped in
// favor of an instant swap.
export function useNavigate() {
  const router = useRouter();
  return useCallback((href: string) => router.push(href), [router]);
}
