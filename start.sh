#!/usr/bin/env bash
# BoxLang doesn't auto-load .env (that was CommandBox's job in the old ColdBox
# app) — export it into the process environment ourselves before boxlang.json's
# ${env.X} substitutions and getSystemSetting() calls need it.
set -a
source "$(dirname "$0")/.env"
set +a
exec boxlang --bx-config "$(dirname "$0")/boxlang.json" "$(dirname "$0")/app.bxs"
