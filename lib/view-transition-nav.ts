"use client";

import { useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { LINKS } from "@/lib/nav-links";

function linkIndex(pathname: string): number {
  return LINKS.findIndex((l) => l.href === pathname);
}

// Wraps Next's client-side navigation in the native View Transitions API, so
// the browser animates a real before/after screenshot of <main> (see
// globals.sass for the actual slide keyframes, keyed off the
// data-nav-direction attribute this sets).
//
// An earlier version of this feature tried to hand-roll the slide by
// capturing the outgoing page's own `children` element into React state and
// keeping it mounted while a new one took over - that doesn't work on this
// Next.js version: instrumenting an actual navigation showed the layout
// receives the exact same `children` reference for the entire session, with
// Next mutating what's rendered *inside* it internally rather than handing
// the layout a new element per route. There's no distinct "old" element to
// capture in the first place, so only a screenshot-based approach (this one)
// is actually correct - it doesn't care how Next represents the content
// internally, only what's on screen before and after.
export function useViewTransitionNavigate() {
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(
    (href: string) => {
      if (href === pathname) return;

      const fromIdx = linkIndex(pathname);
      const toIdx = linkIndex(href);
      const forward = fromIdx === -1 || toIdx === -1 || toIdx > fromIdx;
      document.documentElement.dataset.navDirection = forward ? "forward" : "backward";

      if (!document.startViewTransition) {
        router.push(href);
        return;
      }

      const main = document.querySelector("main");

      document.startViewTransition(
        () =>
          new Promise<void>((resolve) => {
            router.push(href);

            if (!main) {
              resolve();
              return;
            }

            // The route's actual content swap happens asynchronously (an
            // RSC fetch behind the scenes, however brief) - waiting for the
            // first real DOM mutation inside <main> is what actually signals
            // "the new page is here", rather than guessing a fixed delay
            // that could race ahead of it (exactly the bug the hand-rolled
            // version above hit).
            //
            // Deliberately NOT chaining a requestAnimationFrame here before
            // resolving, tempting as an extra settle-frame looks: rAF
            // callbacks are held back by the browser for the entire time
            // this promise is pending (confirmed by instrumenting an actual
            // transition - "mutation observed" logged immediately, but
            // nothing scheduled via rAF after it ever ran, for seconds) -
            // resolving from inside a rAF callback that itself never fires
            // is a deadlock. Resolving synchronously from the observer
            // callback is what actually completes the transition.
            const fallback = setTimeout(() => {
              observer.disconnect();
              resolve();
            }, 1000);
            const observer = new MutationObserver(() => {
              observer.disconnect();
              clearTimeout(fallback);
              resolve();
            });
            observer.observe(main, { childList: true, subtree: true });
          })
      );
    },
    [router, pathname]
  );
}
