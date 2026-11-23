#!/usr/bin/env bash
# Upgrade test: start the stack with OLD_IMAGE, create data, switch to NEW_IMAGE and verify
# migrations, login, and – if migrations ran – the backup and that it can be restored.
#
# Usage: scripts/upgrade-test.sh <old-image> <new-image>
set -euo pipefail

OLD_IMAGE=${1:?old image}
NEW_IMAGE=${2:?new image}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
WORK=$(mktemp -d)
PROJECT=kp-upgrade-test
PORT=3399
ORIGIN="http://localhost:$PORT"

cat > "$WORK/override.yml" <<EOF
services:
  app:
    image: \${KP_IMAGE}
    pull_policy: never
EOF
cat > "$WORK/.env" <<EOF
POSTGRES_PASSWORD=upgrade-test-pw
ORIGIN=$ORIGIN
APP_PORT=$PORT
EOF

compose() {
	docker compose -p "$PROJECT" --env-file "$WORK/.env" \
		-f "$ROOT/docker-compose.yml" -f "$WORK/override.yml" "$@"
}
psql_db() { KP_IMAGE=$NEW_IMAGE compose exec -T db psql -U kontoplaner -d kontoplaner -tAc "$1"; }
# KP_IMAGE must be set for every compose call, otherwise compose rejects the file (also on down).
cleanup() {
	KP_IMAGE=$NEW_IMAGE compose down --volumes >/dev/null 2>&1 || true
	rm -r "$WORK"
}
trap cleanup EXIT
fail() { echo "FAIL: $*" >&2; KP_IMAGE=$NEW_IMAGE compose logs app | tail -30 >&2; exit 1; }

wait_healthy() {
	for _ in $(seq 1 60); do
		[ "$(docker inspect -f '{{.State.Health.Status}}' "$PROJECT-app-1" 2>/dev/null)" = healthy ] && return 0
		sleep 2
	done
	fail "app did not become healthy"
}

KP_IMAGE=$NEW_IMAGE compose down --volumes >/dev/null 2>&1 || true # leftovers of an aborted run

echo "== start $OLD_IMAGE"
KP_IMAGE=$OLD_IMAGE compose up -d --quiet-pull
wait_healthy
curl -sf "$ORIGIN/api/health"; echo

echo "== create admin on old version"
curl -s -o /dev/null -H "Origin: $ORIGIN" \
	--data-urlencode name=Upgrade --data-urlencode username=upgrader \
	--data-urlencode password=upgrade-pass-1 --data-urlencode confirm=upgrade-pass-1 "$ORIGIN/setup"
[ "$(psql_db 'select count(*) from users')" = 1 ] || fail "admin was not created"
BEFORE=$(psql_db 'select count(*) from drizzle.__drizzle_migrations')

echo "== switch to $NEW_IMAGE"
KP_IMAGE=$NEW_IMAGE compose up -d
sleep 3
wait_healthy
curl -sf "$ORIGIN/api/health"; echo
AFTER=$(psql_db 'select count(*) from drizzle.__drizzle_migrations')
echo "migrations: $BEFORE -> $AFTER"

echo "== login with existing account"
RESULT=$(curl -s -H "Origin: $ORIGIN" -H "x-sveltekit-action: true" \
	--data-urlencode username=upgrader --data-urlencode password=upgrade-pass-1 "$ORIGIN/login")
echo "$RESULT" | grep -q '"type":"redirect"' || fail "login after upgrade failed: $RESULT"

BACKUPS=$(KP_IMAGE=$NEW_IMAGE compose exec -T app sh -c 'ls /app/data/backups' || true)
if [ "$AFTER" -gt "$BEFORE" ]; then
	echo "== backup before migration"
	FILE=$(echo "$BACKUPS" | grep '\.dump$' | tail -1)
	[ -n "$FILE" ] || fail "migrations ran but no backup was written"
	echo "backup: $FILE"
	KP_IMAGE=$NEW_IMAGE compose cp "app:/app/data/backups/$FILE" "$WORK/backup.dump"
	KP_IMAGE=$NEW_IMAGE compose cp "$WORK/backup.dump" "db:/tmp/backup.dump"
	psql_db 'create database restore_check' >/dev/null
	KP_IMAGE=$NEW_IMAGE compose exec -T db pg_restore -U kontoplaner -d restore_check --no-owner /tmp/backup.dump
	RESTORED=$(KP_IMAGE=$NEW_IMAGE compose exec -T db psql -U kontoplaner -d restore_check -tAc 'select count(*) from drizzle.__drizzle_migrations')
	[ "$RESTORED" = "$BEFORE" ] || fail "restored backup has $RESTORED migrations, expected $BEFORE (state before update)"
	[ "$(KP_IMAGE=$NEW_IMAGE compose exec -T db psql -U kontoplaner -d restore_check -tAc 'select username from users')" = upgrader ] ||
		fail "restored backup lacks the user"
	echo "restore OK: backup holds the state before the update"
else
	echo "== no migrations pending, so no backup expected"
	[ -z "$(echo "$BACKUPS" | grep '\.dump$' || true)" ] || fail "unexpected backup without migrations: $BACKUPS"
fi

echo "UPGRADE TEST PASSED"
