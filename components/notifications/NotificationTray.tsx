"use client";

import {useNotificationCenter} from "@/lib/notifications";
import styles from "./NotificationTray.module.sass";

// Mounted once at the layout root (see app/layout.tsx), same reasoning as
// Nav.tsx living there instead of inside ViewHost - a reminder needs to
// surface no matter which view happens to be on screen.
export default function NotificationTray() {
    const {active, dismiss} = useNotificationCenter();
    // Full-screen means only one can be shown at a time - the rest just wait
    // their turn in `active` and take over automatically once this one is
    // dismissed or times out (see lib/notifications.ts's DISPLAY_MS).
    const current = active[0];

    return (
        <>
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
