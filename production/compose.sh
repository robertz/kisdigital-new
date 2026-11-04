#!/usr/bin/env bash
# docker compose for the deployment in this folder: ./compose.sh logs -f app,
# ./compose.sh ps ... deploy.sh keeps it current.
here=$(cd "$(dirname "$0")" && pwd)
exec docker compose --project-directory "$here" -f "$here/src/production/docker-compose.yml" "$@"
