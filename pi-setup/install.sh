#!/bin/bash
# Run on the Pi itself, as: sudo ./install.sh [username]
# If username is omitted, uses whoever ran sudo (works fine for the normal
# "sudo ./install.sh" case run as your own login user).
set -euo pipefail

KIOSK_USER="${1:-${SUDO_USER:-}}"
if [ -z "$KIOSK_USER" ]; then
  echo "Usage: sudo ./install.sh [username]" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Installing cage + chromium..."
apt-get update
apt-get install -y --no-install-recommends cage chromium curl wlr-randr

echo "Installing wait-for-dashboard.sh..."
install -m 755 "$SCRIPT_DIR/wait-for-dashboard.sh" /usr/local/bin/wait-for-dashboard.sh

echo "Installing systemd unit for user: $KIOSK_USER"
install -m 644 "$SCRIPT_DIR/dashboard-kiosk@.service" /etc/systemd/system/dashboard-kiosk@.service

echo "Freeing tty1 (cage needs it, can't share with a login getty)..."
systemctl disable --now getty@tty1.service || true

systemctl daemon-reload
systemctl enable "dashboard-kiosk@${KIOSK_USER}.service"

echo
echo "Done. Reboot to see it live: sudo reboot"
echo "Or start it now without rebooting: sudo systemctl start dashboard-kiosk@${KIOSK_USER}.service"
echo "Logs: journalctl -u dashboard-kiosk@${KIOSK_USER}.service -f"
