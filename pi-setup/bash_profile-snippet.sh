# Appended to the kiosk user's ~/.bash_profile by install.sh. Fires labwc
# the moment the auto-logged-in console session starts on tty1 - only on a
# real login shell on tty1, so SSH sessions (which also run .bash_profile)
# don't try to start a second compositor.
if [ -z "$WAYLAND_DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
  exec labwc
fi
