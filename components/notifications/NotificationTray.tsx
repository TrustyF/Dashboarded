"use client";

import {useNotificationCenter, type Notification} from "@/lib/notifications";
import styles from "./NotificationTray.module.sass";

// TEMP: fixtures mirroring what the real rule hooks in lib/notifications.ts
// actually produce, so the test button below can preview both notification
// kinds without waiting for a real event/rain forecast. Remove alongside
// the rest of this test scaffolding.
const TEST_FIXTURES: Omit<Notification, "id">[] = [
    {message: `"Dentist appointment" starts in about an hour`, icon: "bi-calendar-event", value: "3:00 PM"},
    {message: "Rain expected in the next 2 hours", icon: "bi-cloud-rain", value: "2.4mm"},
    {message: "Daily step goal reached", icon: "bi-trophy-fill", value: "10,482 steps"},
];

// Mounted once at the layout root (see app/layout.tsx), same reasoning as
// Nav.tsx living there instead of inside ViewHost - a reminder needs to
// surface no matter which view happens to be on screen.
export default function NotificationTray() {
    const {active, dismiss, push} = useNotificationCenter();
    // Full-screen means only one can be shown at a time - the rest just wait
    // their turn in `active` and take over automatically once this one is
    // dismissed or times out (see lib/notifications.ts's DISPLAY_MS).
    const current = active[0];

    return (
        <>
            {/* TEMP: manual trigger for testing the tray - remove once confirmed working on-device. */}
            <button
                type="button"
                className={styles.testButton}
                onClick={() => {
                    const fixture = TEST_FIXTURES[Math.floor(Math.random() * TEST_FIXTURES.length)];
                    push({id: `test-${Date.now()}`, ...fixture});
                }}
            >
                Test notification
            </button>

            {current && (
                <button type="button" className={styles.overlay} onClick={() => dismiss(current.id)}>
                    <i className={`bi ${current.icon} ${styles.icon}`}/>
                    {current.value && <div className={styles.value}>
                        {current.value}</div>}
                    <span className={styles.message}>{current.message}</span>
                </button>
            )}
        </>
    );
}
