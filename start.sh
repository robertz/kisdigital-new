#!/usr/bin/env bash
# BoxLang (1.18+) picks up both .boxlang.json and .env from the directory it's
# run in, so all this has to do is start from the project root rather than
# wherever it was called from.
cd "$(dirname "$0")"
exec boxlang app.bxs
