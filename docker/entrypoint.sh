#!/bin/sh
set -e

DATA_DIR="${DATA_DIR:-/data}"
PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

mkdir -p "$DATA_DIR/uploads" "$DATA_DIR/backups"

# Already running as an unprivileged user (e.g. `user:` in compose): nothing to switch.
if [ "$(id -u)" != "0" ]; then
  exec "$@"
fi

# Create group / user for the requested ids if they do not exist yet.
if ! getent group "$PGID" >/dev/null 2>&1; then
  groupadd -g "$PGID" pulse
fi
if ! getent passwd "$PUID" >/dev/null 2>&1; then
  useradd -u "$PUID" -g "$PGID" -M -d "$DATA_DIR" -s /usr/sbin/nologin pulse
fi

# Only chown folders whose owner differs (avoids a slow recursive chown on every start). uploads and backups
# are checked on their own because they may be separate mounts (e.g. on another disk).
for dir in "$DATA_DIR" "$DATA_DIR/uploads" "$DATA_DIR/backups"; do
  if [ "$(stat -c '%u:%g' "$dir")" != "$PUID:$PGID" ]; then
    chown -R "$PUID:$PGID" "$dir"
  fi
done

exec gosu "$PUID:$PGID" "$@"
