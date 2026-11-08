# Same shape as dt-next's Dockerfile. App Platform builds the last stage, so
# the test stage sits in the middle and the app is rebuilt from it at the end.

# ── Assets ───────────────────────────────────────────────────────────────
# esbuild bundles and hashes CSS/JS into public/assets/dist/, and Vite builds
# /manage into public/assets/dist/manage/. Both are gitignored, so they're
# built here. Vite 8 needs Node 20.19+ or 22.
FROM node:22-alpine AS assets
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY esbuild.config.mjs ./
COPY scripts scripts
# scanned, not shipped: scripts/build-icons.mjs keeps only the bi-* icons in use
COPY views views
COPY models models
COPY public/assets/css public/assets/css
COPY public/assets/scss public/assets/scss
COPY public/assets/js public/assets/js
COPY manage-app manage-app
RUN npm run build

# ── Runtime ──────────────────────────────────────────────────────────────
# The bare BoxLang CLI: BoxExpress runs its own HTTP server. Pinned so a
# rebuild never changes BoxLang underneath; bump it deliberately. 1.18.0+ is
# required: that's when BoxLang started finding .boxlang.json in the working
# directory, which is where the datasource, caches and module settings live.
FROM ortussolutions/boxlang:cli-1.19.0 AS app

ENV APP_DIR=/app
WORKDIR $APP_DIR

# install-bx-module finds its helper scripts through this. ARG, not ENV: any
# BOXLANG_* variable present at runtime makes BoxLang drop the config file's
# "modules" block, and bx-activitypub then starts with no datasource.
ARG BOXLANG_INSTALL_HOME=/usr/local/boxlang

# The base image ships a sample site in /app.
RUN rm -rf /app/* /app/.[!.]*

# bx-compat-cfml gives dateFormat()/dateTimeFormat() their CF mask meanings
# ("mmm d, yyyy", "h:nn tt"); without it the masks silently become java.time
# patterns. bx-activitypub's moduleName is bxactivitypub.
ARG BOXLANG_MODULES=boxlang-express,bx-mysql,bx-markdown,bx-password-encrypt,bx-esapi,bx-compat-cfml,bx-activitypub,bx-jsoup,bx-mail
# install-bx-module always takes the latest from ForgeBox, but this line never
# changes, so Docker and App Platform's Kaniko builder reuse the cached layer.
# Change this to force a fresh pull, e.g. right after publishing a module fix.
ARG MODULE_CACHE_BUST=2026-11-06-boxlang-express-0.2.25
RUN install-bx-module "$BOXLANG_MODULES" --local

COPY app.bxs .boxlang.json ./
COPY views/ views/
COPY routes/ routes/
COPY models/ models/
# applied at startup by models/util/Migrator.bx
COPY db/migrations/ db/migrations/
COPY public/ public/
COPY --from=assets /app/public/assets/dist public/assets/dist

# An ordinary user, not root. BoxLang keeps its home (compiled classes, caches,
# logs) in ~/.boxlang, so the image's copy moves with it.
RUN useradd --system --create-home --home-dir /home/app --shell /usr/sbin/nologin app \
	&& cp -a /root/.boxlang /home/app/.boxlang \
	&& chown -R app:app /home/app /app
USER app
# the base image sets HOME=/root, where the launcher keeps its startup cache
ENV HOME=/home/app

ENV PORT=3005
EXPOSE 3005

# Fixed sizes, not dt-next's share of the container limit: on App Platform the
# JVM doesn't see the instance's allocation (availableProcessors() has reported
# the host's 8 cores on apps-s-1vcpu-1gb), so a percentage of "RAM" could be a
# percentage of the host's.
# - Xmx600m + SerialGC: a bounded heap and the low-overhead collector for 1 vCPU / 1GB.
# - ActiveProcessorCount=1: Undertow sizes its I/O threads from availableProcessors().
# - MaxDirectMemorySize=64m: Undertow's buffer pool is off-heap direct memory once
#   the heap passes ~128MB; capped, a spike is a loud OutOfMemoryError rather
#   than a silent OOM-kill.
# - ExitOnOutOfMemoryError: a JVM out of memory exits and App Platform restarts it.
# - user.timezone=UTC: publish dates are stored as UTC and compared to MySQL's NOW().
# - sun.net.inetaddr.ttl=30: a looked-up address is kept 30 seconds, so the
#   address SafeHttp checks is the one it connects to (models/util/SafeHttp.bx).
ENV JAVA_OPTS="-Duser.timezone=UTC -Xmx600m -Xms128m -XX:+UseSerialGC -XX:ActiveProcessorCount=1 -XX:MaxDirectMemorySize=64m -XX:+ExitOnOutOfMemoryError -Dsun.net.inetaddr.ttl=30"

# Java is started directly rather than through the `boxlang` launcher. The
# launcher appends -XX:TieredStopAtLevel=1 (quick startup, but only the first-tier
# compiler: a long-running server never gets fully optimised code), and the only
# thing it puts after that is BOXLANG_OPTS, which dt-next uses for
# TieredStopAtLevel=4. Here a BOXLANG_* variable makes BoxLang drop .boxlang.json's
# "modules" block and bx-activitypub fails at startup, so instead this runs the
# same class from the same jar with TieredStopAtLevel=4 last. exec keeps Java as
# PID 1, so it gets the container's stop signal.
CMD ["sh", "-c", "exec java $JAVA_OPTS -XX:TieredStopAtLevel=4 -cp \"$(ls /usr/local/boxlang/lib/boxlang-[0-9]*.jar | head -n 1)\" ortus.boxlang.runtime.BoxRunner app.bxs"]

# ── Tests ────────────────────────────────────────────────────────────────
# The specs, run in the image above: the same BoxLang and modules as
# production, so code that needs a module production doesn't install fails
# here rather than live. The specs touch no database, but BoxLang opens the
# JDBC-backed caches at startup, so a reachable MySQL is still needed:
#
#   docker build --target test -t kisdigital:test .
#   docker run --rm --env-file .env -e CHRON_DB_HOST=host.docker.internal \
#     --add-host host.docker.internal:host-gateway kisdigital:test

# TestBox, installed from box.json as `box install` does locally. Pinned so a
# rebuild doesn't change CommandBox underneath.
FROM ortussolutions/commandbox:jdk21-alpine-3.24.0 AS testbox
WORKDIR /deps
COPY box.json ./
RUN box install && rm -rf testbox/tests testbox/bx/tests

FROM app AS test
COPY --from=testbox --chown=app:app /deps/testbox testbox/
COPY --chown=app:app tests/ tests/
COPY --chown=app:app run-tests.bxs ./
CMD ["boxlang", "run-tests.bxs"]

# ── Production ───────────────────────────────────────────────────────────
# The last stage is what App Platform builds and deploys.
FROM app AS production
