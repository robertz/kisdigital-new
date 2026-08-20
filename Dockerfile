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
FROM ortussolutions/commandbox:boxlang

ENV APP_DIR=/app
WORKDIR $APP_DIR

# This image only has CommandBox's own `box` CLI (for running apps under its
# Runwar server) — no standalone `boxlang` binary. This app needs the bare
# CLI, since boxlang-express runs its own com.sun.net.httpserver.HttpServer
# via app.listen() rather than running under Runwar/CommandBox's server model.
# Install it the same way the official ortussolutions/boxlang:cli image does.
ENV BOXLANG_VERSION=1.16.0
RUN curl -fsSL https://install.boxlang.io | bash -s -- ${BOXLANG_VERSION} --without-commandbox

# commandbox-boxlang teaches `box install` how to resolve a "boxlang-modules"
# typed ForgeBox package whose downloadURL is a GitHub-shorthand string
# (boxlang-express isn't a tagged ForgeBox release) — without it, `box
# install boxlang-express` reports success but silently installs nothing.
# The other modules below (bx-mysql, bx-markdown, bx-password-encrypt) are
# real published ForgeBox packages and would resolve without this, but it's
# harmless to have installed for all of them.
RUN box install commandbox-boxlang --system

# The base image bakes a sample CommandBox site into /app (403.html,
# index.cfm, webroot/, etc.) — clear it so nothing shadows this app's own
# files or confuses BoxLang's config/module resolution.
RUN rm -rf /app/* /app/.[!.]*

COPY app.bxs boxlang.json ./
COPY views/ views/
COPY routes/ routes/
COPY models/ models/
COPY public/ public/
COPY --from=assets /app/public/assets/dist public/assets/dist

# boxlang-express itself + the modules that back this app's markdown(),
# BCryptHash()/BCryptVerify(), encodeForHTML()/encodeForURL()/etc., and
# MySQL datasource. bx-compat-cfml supplies classic CF-style dateFormat()/
# dateTimeFormat() mask translation (e.g. "mmm d, yyyy", "h:nn tt") — without
# it, masks fall through to raw java.time pattern semantics, where lowercase
# m means minute (not month), there's no am/pm letter, and uppercase D/Y mean
# day-of-year/week-based-year — silently wrong output, not an error, for most
# masks used across the app (post dates, RSS/sitemap timestamps).
#
# boxlang-express resolves through this same bare-name `box install` (backed
# by commandbox-boxlang above, which teaches `box install` to follow its
# ForgeBox listing's GitHub-shorthand downloadURL) rather than a direct
# `github:robertz/boxlang-express` install — every module here goes through
# one uniform path.
ENV BOXLANG_MODULES=boxlang-express,bx-mysql,bx-markdown,bx-password-encrypt,bx-esapi,bx-compat-cfml

# Installed at build time, not container start: `box install X --local` only
# places a "boxlang-modules"-typed package (boxlang-express) into
# CommandBox's own serverHome, not this app's boxlang_modules/ — the bare
# `boxlang` CLI used below only looks in ./boxlang_modules or
# ~/.boxlang/modules, so each module has to be copied out after install.
# Baking this into the image (rather than doing it in an entrypoint script at
# container start, as an earlier version of this Dockerfile did) means a
# container boots without depending on ForgeBox being reachable — relevant on
# a platform like DigitalOcean App Platform, where a slow or unreachable
# ForgeBox at container start would otherwise stall past the readiness probe.
RUN for module in $(echo "$BOXLANG_MODULES" | tr "," "\n"); do \
		echo "[build] installing module: $module" && \
		box install "$module" --local && \
		installedPath=$(find /usr/local/lib/serverHome -maxdepth 5 -type d -name "$module" 2>/dev/null | head -1) && \
		if [ -n "$installedPath" ]; then \
			mkdir -p "$APP_DIR/boxlang_modules" && \
			cp -r "$installedPath" "$APP_DIR/boxlang_modules/$module" && \
			echo "[build] relocated $module -> $APP_DIR/boxlang_modules/$module"; \
		else \
			echo "[build] ERROR: could not find installed module '$module' under the server home to relocate" >&2 && \
			exit 1; \
		fi \
	done

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
# allocation. Pinning it avoids any 8-core-assuming thread pool (e.g. a
# default ForkJoinPool) over-provisioning against a single real core.
# SerialGC itself is unaffected either way — it's single-threaded already.
ENV JAVA_OPTS="-Xmx400m -Xms128m -XX:+UseSerialGC -XX:ActiveProcessorCount=1"

CMD ["boxlang", "--bx-config", "boxlang.json", "app.bxs"]
