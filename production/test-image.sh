#!/usr/bin/env bash
# Runs the specs in the production image (the Dockerfile's test stage), so they
# see only what production has: its BoxLang and modules. deploy.sh runs it
# before swapping the app over; by hand, from a checkout:
#
#   production/test-image.sh [env file]
#
# The specs touch no database, but BoxLang opens the JDBC-backed caches as it
# starts, so it needs a schema that has the Cache table. The login and schema
# (CHRON_DB_USER, CHRON_DB_PASSWORD, CHRON_DB_NAME) come from the env file,
# .env by default. The server is MySQL's container, reached on its Docker
# network: TEST_DB_HOST (do-mirror-mysql) on MYSQL_NETWORK (docker-mysql_default).
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
src=$(cd "$here/.." && pwd)
env_file=${1:-$src/.env}
network=${MYSQL_NETWORK:-docker-mysql_default}

if [[ ! -f $env_file ]]; then
	echo "No $env_file to take the database login from" >&2
	exit 1
fi

# a setting from the env file, without quotes around it
value() {
	grep -E "^$1=" "$env_file" | tail -n 1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/' || true
}

# the login goes in a file, not on the command line, where ps would show it
login=$(mktemp)
trap 'rm -f "$login"' EXIT
chmod 600 "$login"
{
	echo "CHRON_DB_HOST=${TEST_DB_HOST:-do-mirror-mysql}"
	echo "CHRON_DB_PORT=${TEST_DB_PORT:-3306}"
	echo "CHRON_DB_NAME=$(value CHRON_DB_NAME)"
	echo "CHRON_DB_USER=$(value CHRON_DB_USER)"
	echo "CHRON_DB_PASSWORD=$(value CHRON_DB_PASSWORD)"
} > "$login"

previous=$(docker image inspect -f '{{.Id}}' kisdigital:test 2> /dev/null || true)
echo "Building the test image"
docker build --quiet --target test -t kisdigital:test "$src" > /dev/null
current=$(docker image inspect -f '{{.Id}}' kisdigital:test)
if [[ -n $previous && $previous != "$current" ]]; then
	docker image rm "$previous" > /dev/null 2>&1 || true
fi

echo "Running the specs in it"
docker run --rm --network "$network" --env-file "$login" kisdigital:test
