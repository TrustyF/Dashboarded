"use client";

import { useEffect } from "react";
import { prefetchOtherViews } from "@/lib/prefetch-other-views";

// Mounted once from the root layout, alongside Nav - unlike a page
// component, layout.tsx's children are the only thing that swap on
// navigation, so this never unmounts/remounts as the kiosk moves between
// routes. That makes the effect below a true "once per app session" prefetch
// instead of "once per visit to whichever page happens to render it".
export default function AppPrefetch() {
  useEffect(() => {
    const schedule = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1000));
    const cancel = window.cancelIdleCallback ?? clearTimeout;
    const id = schedule(prefetchOtherViews);
    return () => cancel(id as never);
  }, []);

  return null;
}
