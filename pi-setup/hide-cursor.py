#!/usr/bin/env python3
"""Forces Chromium to actually hide the mouse cursor right after it launches.

app/globals.sass already sets `cursor: none` under [data-kiosk] - but
Chromium only re-evaluates which cursor image to show as a result of hit-
testing an actual pointer event, not on paint/layout. So on a fresh boot, the
OS-drawn arrow cursor just sits at wherever the compositor last placed it,
visible, until the first real touch/mouse move triggers that hit test.

This sends two synthetic mousemove events over CDP (one isn't enough -
Chromium's cursor hit-test needs a movement between two distinct points, not
a single mouseMoved at the pointer's already-current position) to trigger the
same re-evaluation without needing a real physical touch. Called from
pi-setup/labwc-autostart shortly after chromium launches.
"""

import sys

import cdp_client

DASHBOARD_URL_PREFIX = "http://localhost:3000"


def main() -> int:
    try:
        target = cdp_client.find_target(DASHBOARD_URL_PREFIX)
    except Exception as err:
        print(f"hide-cursor: couldn't reach CDP on {cdp_client.CDP_HOST}:{cdp_client.CDP_PORT} - {err}", file=sys.stderr)
        return 1

    if target is None:
        print(f"hide-cursor: no open tab matching {DASHBOARD_URL_PREFIX} found", file=sys.stderr)
        return 1

    try:
        ws_url = target["webSocketDebuggerUrl"]
        cdp_client.send_command(ws_url, "Input.dispatchMouseEvent", {"type": "mouseMoved", "x": 0, "y": 0})
        cdp_client.send_command(ws_url, "Input.dispatchMouseEvent", {"type": "mouseMoved", "x": 1, "y": 1})
    except Exception as err:
        print(f"hide-cursor: failed to send nudge - {err}", file=sys.stderr)
        return 1

    print("hide-cursor: cursor nudge sent")
    return 0


if __name__ == "__main__":
    sys.exit(main())
