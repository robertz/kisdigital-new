# Testing

Running the module's own test suite, and what the 13 specs actually cover.

## Running it

```bash
box install
```

then start `tests/resources/App` as a CommandBox server (webroot = that directory) and hit `/testrunner.cfm`. See `tests/resources/App/config/ColdBox.cfc` for the exact settings a consuming app needs (it _is_ a minimal consuming app).

## What's covered

13 specs across three files, verified live on both Lucee and BoxLang:

- **`tests/specs/GraphQLServiceSpec.cfc`** — the resolver convention in-process: `PropertyDataFetcher` fallback, explicit-resolver precedence, missing-resolver-class fallback, and spec-shaped errors for an invalid query.
- **`tests/specs/GraphQLHandlerSpec.cfc`** — the real thing end-to-end, real HTTP POSTs against the running `/graphql` route: the happy path, a malformed request body, and a handful of regression tests for specific bugs found and fixed during a code review — a non-string `query`/`operationName` (used to crash uncaught instead of returning a graceful 400), resolvers actually receiving the ColdBox `event` as `context` (used to always be null), and a resolver with its own broken WireBox dependency surfacing as a real error (used to silently fall back to `PropertyDataFetcher` instead).
- **`tests/specs/GraphQLServiceConfigSpec.cfc`** — startup config validation: a bad wildcard `schemaPaths` directory now fails fast at build time instead of silently dropping that schema fragment. These specs build their own throwaway `GraphQLService` instance (via `getWireBox().autowire()` + `setSettings()`) rather than touching the app's real singleton — the reason `GraphQLService.cfc` has `accessors="true"`.

## What's not covered

Two internal caching optimizations (`JavaClassFactory`'s class-handle cache, `DataFetcherAdapter`'s per-field `PropertyDataFetcher` cache) — both are already exercised indirectly by every other spec (many distinct classes/fields resolving correctly across dozens of calls), so a dedicated test would mostly be reflecting into cache internals rather than asserting on observable behavior.
