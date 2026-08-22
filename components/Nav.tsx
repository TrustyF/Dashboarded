"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "./Nav.module.sass";

// Port of NavOverlay.vue: a floating icon pill, hidden by default (kiosk-style,
// stays out of the way on a wall display) that appears when you swipe up from
// the bottom edge of the screen and auto-hides after 10s of inactivity, or
// immediately if you tap elsewhere. Settings_overlay's brightness toggle now
// lives at /settings instead, as a full page rather than an overlay.
//
// The gesture strip (.edge) is a thin dedicated zone right at the bottom
// edge, not a tall overlay spanning the height of a whole card - it exists
// only to catch the swipe, so it can own its pointer events directly and
// there's no click-through problem to solve: nothing else meaningful lives
// in that last EDGE_HEIGHT_PX sliver of the screen.
//
// Separately, a horizontal swipe anywhere on the page (not just the edge
// strip - this one's about switching pages, not revealing the nav) steps
// through LINKS in order. It's detected at the document level rather than on
// some dedicated zone, same reasoning as the reveal strip's swipe-up: every
// pointer event bubbles to document regardless of what it actually hit, and
// checking which axis dominated the drag on release is enough to tell a
// horizontal page-swipe apart from, say, scrolling the calendar timeline
// vertically - no exclusion zone needed.

const LINKS = [
  { href: "/", icon: "bi-house-fill", iconInactive: "bi-house", label: "Home" },
  { href: "/weather", icon: "bi-cloud-fill", iconInactive: "bi-cloud", label: "Weather" },
  { href: "/spotify", icon: "bi-music-note", iconInactive: "bi-music-note", label: "Spotify" },
  { href: "/health", icon: "bi-lungs-fill", iconInactive: "bi-lungs", label: "Health" },
  { href: "/sensors", icon: "bi-thermometer-high", iconInactive: "bi-thermometer-low", label: "Sensors" },
  { href: "/system", icon: "bi-hdd-network-fill", iconInactive: "bi-hdd-network", label: "System" },
  { href: "/settings", icon: "bi-gear-fill", iconInactive: "bi-gear", label: "Settings" },
];

const HIDE_DELAY_MS = 10_000;
const SWIPE_UP_THRESHOLD_PX = 40;
// Bigger than the reveal strip's threshold - switching the whole page is a
// more consequential action than popping up the nav, so it should take a
// clearly deliberate drag rather than a short flick.
const SWIPE_X_THRESHOLD_PX = 80;

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [hidden, setHidden] = useState(true);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pillRef = useRef<HTMLDivElement>(null);
  // Which pointer started the current swipe, where it started, and whether
  // it's already crossed the threshold and fired show() - a ref (not state)
  // since it's only ever read/written from pointer handlers, never rendered.
  const gesture = useRef<{ pointerId: number; startY: number; triggered: boolean } | null>(null);
  // Same idea for the page-switch swipe, tracked separately since it lives on
  // document rather than the edge strip and only resolves on release instead
  // of firing mid-drag.
  const pageSwipe = useRef<{ pointerId: number; startX: number; startY: number } | null>(null);

  function show() {
    setHidden(false);
    clearTimeout(hideTimeout.current);
    hideTimeout.current = setTimeout(() => setHidden(true), HIDE_DELAY_MS);
  }

  function handlePointerDown(e: React.PointerEvent) {
    gesture.current = { pointerId: e.pointerId, startY: e.clientY, triggered: false };
  }

  function handlePointerMove(e: React.PointerEvent) {
    const g = gesture.current;
    if (!g || g.triggered || e.pointerId !== g.pointerId) return;
    if (g.startY - e.clientY >= SWIPE_UP_THRESHOLD_PX) {
      g.triggered = true;
      show();
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (gesture.current?.pointerId === e.pointerId) gesture.current = null;
  }

  // Tapping anywhere outside the pill hides it early, instead of waiting out
  // the full HIDE_DELAY_MS. The edge strip doesn't need to be excluded here -
  // tapping it without swiping just does nothing either way.
  useEffect(() => {
    function onDocumentClick(e: MouseEvent) {
      if (pillRef.current && !pillRef.current.contains(e.target as Node)) {
        setHidden(true);
        clearTimeout(hideTimeout.current);
      }
    }
    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, []);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      pageSwipe.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY };
    }

    function onPointerUp(e: PointerEvent) {
      const g = pageSwipe.current;
      pageSwipe.current = null;
      if (!g || g.pointerId !== e.pointerId) return;

      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      if (Math.abs(dx) < SWIPE_X_THRESHOLD_PX || Math.abs(dx) <= Math.abs(dy)) return;

      const currentIndex = LINKS.findIndex((link) => link.href === pathname);
      if (currentIndex === -1) return;

      // Swiping left moves forward through the list (like turning a page),
      // swiping right moves back.
      const step = dx < 0 ? 1 : -1;
      const target = LINKS[(currentIndex + step + LINKS.length) % LINKS.length];
      router.push(target.href);
    }

    function onPointerCancel() {
      pageSwipe.current = null;
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerCancel);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [pathname, router]);

  return (
    <>
      <div
        className={styles.edge}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      <div className={styles.pill} data-hidden={hidden} ref={pillRef}>
        <nav className={styles.wrapper}>
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={active ? `${styles.box} ${styles.active}` : styles.box}
                aria-label={link.label}
              >
                <i className={active ? `bi ${link.icon}` : `bi ${link.iconInactive}`} />
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
