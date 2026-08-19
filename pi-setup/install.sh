#!/bin/bash
# Run on the Pi itself, as: sudo ./install.sh [username]
# If username is omitted, uses whoever ran sudo (works fine for the normal
# "sudo ./install.sh" case run as your own login user).
#
# Uses labwc (Raspberry Pi's own Wayland compositor, patched for their GPU
# driver stack) rather than cage - cage hit an unresolved EGL/wlroots
# incompatibility on this hardware (see project history/commit log) that
# labwc doesn't have, since Raspberry Pi Foundation tests/patches wlroots
# against labwc specifically.
set -euo pipefail

KIOSK_USER="${1:-${SUDO_USER:-}}"
if [ -z "$KIOSK_USER" ]; then
  echo "Usage: sudo ./install.sh [username]" >&2
  exit 1
fi
KIOSK_HOME="$(getent passwd "$KIOSK_USER" | cut -d: -f6)"
if [ -z "$KIOSK_HOME" ]; then
  echo "Could not resolve home directory for user: $KIOSK_USER" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Installing labwc + chromium..."
apt-get update
# libinput-tools isn't needed to run the kiosk - it's `libinput list-devices`,
# for debugging touch calibration (pi-setup/rc.xml) if taps ever misbehave.
apt-get install -y --no-install-recommends labwc chromium curl wlr-randr libinput-tools

echo "Installing wait-for-dashboard.sh..."
install -m 755 "$SCRIPT_DIR/wait-for-dashboard.sh" /usr/local/bin/wait-for-dashboard.sh

echo "Installing labwc autostart for user: $KIOSK_USER"
install -d -o "$KIOSK_USER" -g "$KIOSK_USER" "$KIOSK_HOME/.config/labwc"
install -m 755 -o "$KIOSK_USER" -g "$KIOSK_USER" "$SCRIPT_DIR/labwc-autostart" "$KIOSK_HOME/.config/labwc/autostart"
install -m 644 -o "$KIOSK_USER" -g "$KIOSK_USER" "$SCRIPT_DIR/rc.xml" "$KIOSK_HOME/.config/labwc/rc.xml"

echo "Wiring labwc to launch on console login..."
BASH_PROFILE="$KIOSK_HOME/.bash_profile"
touch "$BASH_PROFILE"
if ! grep -qF "exec labwc" "$BASH_PROFILE"; then
  cat "$SCRIPT_DIR/bash_profile-snippet.sh" >> "$BASH_PROFILE"
  chown "$KIOSK_USER:$KIOSK_USER" "$BASH_PROFILE"
fi

echo "Removing the old cage-based kiosk service, if present..."
systemctl disable --now "dashboard-kiosk@${KIOSK_USER}.service" 2>/dev/null || true
rm -f "/etc/systemd/system/dashboard-kiosk@.service"

echo "Enabling console autologin for tty1..."
mkdir -p /etc/systemd/system/getty@tty1.service.d
# %I in a getty@.service template expands to the tty name (e.g. "tty1"), not
# a username - --autologin needs the literal username, so this is generated
# per-install rather than copied from a static file (learned this the hard
# way: --autologin %I tries to authenticate as a user named "tty1").
cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf <<EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin ${KIOSK_USER} --noclear %I \$TERM
EOF
systemctl daemon-reload
# The old setup disabled getty@tty1 entirely (cage needed sole ownership of
# the tty); the new approach needs it enabled again, now with autologin.
systemctl enable getty@tty1.service
systemctl restart getty@tty1.service

echo
echo "Done. Reboot to see it live: sudo reboot"
echo "Logs (labwc/chromium run as a login shell, not a systemd service - check the actual screen, or):"
echo "  journalctl -b | grep -iE 'labwc|chromium'"
