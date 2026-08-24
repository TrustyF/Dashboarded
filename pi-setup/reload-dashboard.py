#!/usr/bin/env python3
"""Reload the kiosk's dashboard tab in place, over Chrome DevTools Protocol.

Run on the Pi itself (deploy-to-pi.ps1 does this over ssh after `docker
compose up -d`). Deliberately doesn't touch the chromium process - labwc's
autostart (see pi-setup/labwc-autostart) launches it once with no supervisor,
so killing it would leave the physical screen dead until someone power-cycles
the Pi. CDP's Page.reload just tells the already-running tab to reload, same
as a person pressing F5.
"""

import sys

import cdp_client

DASHBOARD_URL_PREFIX = "http://localhost:3000"


def main() -> int:
    try:
        target = cdp_client.find_target(DASHBOARD_URL_PREFIX)
    except Exception as err:
        print(f"reload-dashboard: couldn't reach CDP on {cdp_client.CDP_HOST}:{cdp_client.CDP_PORT} - {err}", file=sys.stderr)
        return 1

    if target is None:
        print(f"reload-dashboard: no open tab matching {DASHBOARD_URL_PREFIX} found", file=sys.stderr)
        return 1

    try:
        cdp_client.send_command(target["webSocketDebuggerUrl"], "Page.reload", {"ignoreCache": True})
    except Exception as err:
        print(f"reload-dashboard: reload failed - {err}", file=sys.stderr)
        return 1

    print("reload-dashboard: reload sent")
    return 0


if __name__ == "__main__":
    sys.exit(main())
