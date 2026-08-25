# ── Assets ───────────────────────────────────────────────────────────────
# esbuild bundles + hashes CSS/JS into public/assets/dist/ (gitignored, so it
# has to be produced here rather than assumed present in the build context).
FROM node:20-alpine AS assets
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY esbuild.config.mjs ./
COPY public/assets/css public/assets/css
COPY public/assets/js public/assets/js
RUN npm run build

# ── Runtime ──────────────────────────────────────────────────────────────
# ortussolutions/boxlang:cli, not commandbox:boxlang — this app runs its own
# com.sun.net.httpserver.HttpServer via app.listen() rather than under
# Runwar/CommandBox's server model, so it only ever needed the bare `boxlang`
# CLI. commandbox:boxlang was used previously purely to get CommandBox's
# `box install` for fetching modules from ForgeBox — boxlang:cli's own
# install-bx-module does the same job natively (see below), so CommandBox
# isn't needed at all. Same Ubuntu 24.04 base as commandbox:boxlang, at
# roughly a third of the image size (611MB vs 1.53GB before any app layers).
FROM ortussolutions/boxlang:cli

ENV APP_DIR=/app
WORKDIR $APP_DIR

# install-bx-module looks for its helper scripts relative to BOXLANG_INSTALL_HOME
# (or BVM_HOME) — the image ships them at /usr/local/boxlang/scripts/helpers/
# but doesn't set either variable itself, so install-bx-module fails with
# "Helper scripts not found" until this is set.
ENV BOXLANG_INSTALL_HOME=/usr/local/boxlang

# The base image bakes a sample site into /app (403.html, index.bxm, a logo)
# — clear it so nothing shadows this app's own files or confuses BoxLang's
# config/module resolution.
RUN rm -rf /app/* /app/.[!.]*

# install-bx-module resolves every module here natively against ForgeBox,
# installing straight into boxlang_modules/ with no relocate step needed
# (unlike box install, which only ever placed a "boxlang-modules"-typed
# package into CommandBox's own serverHome). bx-compat-cfml supplies classic
# CF-style dateFormat()/dateTimeFormat() mask translation (e.g. "mmm d,
# yyyy", "h:nn tt") — without it, masks fall through to raw java.time
# pattern semantics, where lowercase m means minute (not month), there's no
# am/pm letter, and uppercase D/Y mean day-of-year/week-based-year —
# silently wrong output, not an error, for most masks used across the app
# (post dates, RSS/sitemap timestamps).
#
# boxlang-express used to need special-case handling here: its ForgeBox
# listing's downloadURL was a CommandBox-style GitHub-shorthand string
# ("owner/repo#tag") that install-bx-module couldn't expand. Now that it's
# published as a real ForgeBox-hosted release (downloadURL: "forgeboxStorage",
# confirmed via `curl https://forgebox.io/api/v1/entry/boxlang-express`),
# it resolves the same as everything else — no special-casing needed.
ENV BOXLANG_MODULES=boxlang-express,bx-mysql,bx-markdown,bx-password-encrypt,bx-esapi,bx-compat-cfml

# install-bx-module always resolves "latest" from ForgeBox, but this RUN
# line's own content never changes — so both local Docker and DigitalOcean
# App Platform's Kaniko-based builder treat it as cache-eligible and happily
# reuse a stale layer, silently keeping an old module version around even
# after a fresh ForgeBox publish (confirmed directly: DO's build log showed
# "Using caching version of cmd: RUN install-bx-module..." on a
# --force-rebuild deploy). Bumping this ARG's value is what actually busts
# that cache — change it any time a module needs a guaranteed fresh pull
# (e.g. right after publishing a fix to ForgeBox), not just when chasing a
# stale build.
ARG MODULE_CACHE_BUST=2026-08-23
RUN install-bx-module "$BOXLANG_MODULES" --local

COPY app.bxs boxlang.json ./
COPY views/ views/
COPY routes/ routes/
COPY models/ models/
COPY public/ public/
COPY --from=assets /app/public/assets/dist public/assets/dist

EXPOSE 3005

# The `boxlang` launcher (a standard Gradle-generated start script) appends
# $JAVA_OPTS to its own default JVM flags (-XX:TieredStopAtLevel=1
# -Xshare:auto -XX:SharedArchiveFile=...) rather than replacing them — this
# doesn't disable the AppCDS shared archive or JIT tiering it sets up.
# Capped heap + SerialGC: this runs on a small, single-container instance
# (DigitalOcean App Platform's basic tier), where SerialGC's single-threaded,
# lower-overhead collection is a better fit than the default (G1, tuned for
# multi-core hosts with room to spare) and a bounded max heap keeps the JVM
# from growing to fill however much RAM the instance happens to have.
#
# ActiveProcessorCount=1: this instance is provisioned as apps-s-1vcpu-1gb
# (see .do/app.yaml), but Runtime.availableProcessors() has been observed
# reporting 8 — the host's full core count, not this container's actual
# allocation. Pinning it avoids any 8-core-assuming thread pool over-
# provisioning against a single real core — this matters even more since
# boxlang-express moved to Undertow (see its own commit history): XNIO
# sizes its I/O thread pool from this same availableProcessors() call.
# SerialGC itself is unaffected either way — it's single-threaded already.
#
# MaxDirectMemorySize=64m: Undertow defaults to off-heap direct ByteBuffers
# for its buffer pool once heap exceeds ~128MB (ours does), and BoxExpress's
# listen() never calls setDirectBuffers(false) to opt out — so that pool
# lives entirely outside the Xmx cap above, untracked, on a container with
# only 1GB total RAM. Left uncapped, a spike there risks a silent OOM-kill
# from the container's own memory limit (no heap-space exception, no stack
# trace, the process just disappears). Capping it turns that into a normal,
# loud `OutOfMemoryError: Direct buffer memory` instead.
ENV JAVA_OPTS="-Xmx600m -Xms128m -XX:+UseSerialGC -XX:ActiveProcessorCount=1 -XX:MaxDirectMemorySize=64m"

CMD ["boxlang", "--bx-config", "boxlang.json", "app.bxs"]
