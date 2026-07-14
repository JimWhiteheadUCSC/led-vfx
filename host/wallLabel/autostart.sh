#!/bin/sh
# host/wallLabel/autostart.sh — symlink or copy to ~/.config/labwc/autostart.
#
# labwc runs with `-m` on Raspberry Pi Desktop (see /usr/bin/labwc-pi),
# so a user autostart file augments rather than replaces
# /etc/xdg/labwc/autostart's panel/file-manager/kanshi entries - safe to
# add without disturbing the rest of the desktop.
#
# The render daemon is NOT started here - still a manual `npm run sim`
# (or `node host/daemon.js ... --display matrix ...`), per the
# still-deferred phase-5 systemd split. This only launches the wall-label
# server + a kiosk browser pointed at it.
#
# Setup:
#   chmod +x host/wallLabel/autostart.sh
#   ln -s "$(pwd)/host/wallLabel/autostart.sh" ~/.config/labwc/autostart
# then a full logout/login or reboot - labwc does not re-read autostart
# on --reconfigure/SIGHUP, only at session start.

REPO_DIR="$(cd "$(dirname "$(readlink -f "$0")")/../.." && pwd)"
WALL_LABEL_PORT=8081
WALL_LABEL_URL="http://localhost:$WALL_LABEL_PORT"

( cd "$REPO_DIR" && exec node host/wallLabel/server.js --port "$WALL_LABEL_PORT" ) \
  >"$HOME/.cache/wall-label-server.log" 2>&1 &

# Bounded poll rather than a guessed fixed sleep - the server starts
# fast but not instantly, and boot-time variability makes a fixed delay
# unreliable either way.
for i in $(seq 1 20); do
  curl -s -o /dev/null "$WALL_LABEL_URL" && break
  sleep 0.25
done

chromium \
  --kiosk --app="$WALL_LABEL_URL" \
  --ozone-platform=wayland \
  --user-data-dir="$HOME/.cache/wall-label-chromium" \
  --noerrdialogs --disable-infobars --disable-session-crashed-bubble \
  --disable-pinch --overscroll-history-navigation=0 \
  >"$HOME/.cache/wall-label-chromium.log" 2>&1 &
