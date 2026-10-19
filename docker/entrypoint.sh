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

can_access() {
  gosu "$PUID:$PGID" test -r "$1" -a -w "$1" -a -x "$1"
}

# Permissions are only fixed when needed (avoids a slow recursive chown on every start). uploads and backups are
# checked on their own because they may be separate mounts, e.g. NAS shares whose ACLs (mode d---------+) deny
# access although the owner is right.
for dir in "$DATA_DIR" "$DATA_DIR/uploads" "$DATA_DIR/backups"; do
  if [ "$(stat -c '%u:%g' "$dir")" != "$PUID:$PGID" ] || ! can_access "$dir"; then
    chown -R "$PUID:$PGID" "$dir"
    chmod -R u+rwX "$dir"
  fi
  if ! can_access "$dir"; then
    echo "WARN $dir is not readable and writable for $PUID:$PGID - check the folder permissions on the host" >&2
  fi
done

exec gosu "$PUID:$PGID" "$@"
