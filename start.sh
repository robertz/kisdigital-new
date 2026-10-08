#!/usr/bin/env bash
# BoxLang (1.18+) picks up both .boxlang.json and .env from the directory it's
# run in, so all this has to do is start from the project root rather than
# wherever it was called from.
cd "$(dirname "$0")"
# Publish dates are stored as UTC, so the JVM runs in UTC as it does in
# production rather than on this machine's clock.
export JAVA_OPTS="${JAVA_OPTS:-} -Duser.timezone=UTC"
exec boxlang app.bxs
