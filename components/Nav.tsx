"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "./Nav.module.sass";

// Port of NavOverlay.vue: a floating icon pill, hidden by default (kiosk-style,
// stays out of the way on a wall display) that appears when you tap/click the
// bottom strip of the screen and auto-hides after 10s of inactivity, or
// immediately if you click elsewhere. Settings_overlay's brightness toggle
// now lives at /settings instead, as a full page rather than an overlay.

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

export default function Nav() {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(true);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Covers the whole reveal strip, not just the pill - clicking anywhere in
  // the strip (not only directly on the pill) should show/refresh it rather
  // than immediately re-triggering the "clicked outside" hide below.
  const clickAreaRef = useRef<HTMLDivElement>(null);

  function show() {
    setHidden(false);
    clearTimeout(hideTimeout.current);
    hideTimeout.current = setTimeout(() => setHidden(true), HIDE_DELAY_MS);
  }

  useEffect(() => {
    function onDocumentClick(e: MouseEvent) {
      if (clickAreaRef.current && !clickAreaRef.current.contains(e.target as Node)) {
        setHidden(true);
        clearTimeout(hideTimeout.current);
      }
    }
    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, []);

  return (
    <div className={styles.clickArea} onClick={show} ref={clickAreaRef}>
      <div className={styles.overlayWrapper} data-hidden={hidden}>
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
    </div>
  );
}
