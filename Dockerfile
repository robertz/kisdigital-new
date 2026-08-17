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
ENV BOXLANG_MODULES=bx-mysql,bx-markdown,bx-password-encrypt,bx-esapi,bx-compat-cfml

# Pinned to an exact tag and installed straight from GitHub (github:user/repo#ref),
# not `box install boxlang-express` by bare name. That resolves through ForgeBox's
# own listing for the package, which points at a location string in
# boxlang-express's own box.json — after publishing a fix there (bumping box.json's
# version and location) a build still picked up the previous release, apparently a
# ForgeBox-side propagation delay on what "latest" resolves to. A direct GitHub tag
# reference isn't subject to that: it's exactly the ref, not something resolved
# through a registry that can lag.
ENV BOXLANG_EXPRESS_REF=v0.1.16

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
RUN box install "robertz/boxlang-express#${BOXLANG_EXPRESS_REF}" --local && \
	installedPath=$(find /usr/local/lib/serverHome -maxdepth 5 -type d -name "boxlang-express" 2>/dev/null | head -1) && \
	if [ -n "$installedPath" ]; then \
		mkdir -p "$APP_DIR/boxlang_modules" && \
		cp -r "$installedPath" "$APP_DIR/boxlang_modules/boxlang-express" && \
		echo "[build] relocated boxlang-express -> $APP_DIR/boxlang_modules/boxlang-express"; \
	else \
		echo "[build] ERROR: could not find installed module 'boxlang-express' under the server home to relocate" >&2 && \
		exit 1; \
	fi

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

CMD ["boxlang", "--bx-config", "boxlang.json", "app.bxs"]
