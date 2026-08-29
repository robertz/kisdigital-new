# Engine Compatibility

What's actually been verified on each CFML/BoxLang engine.

| Engine | Status |
|---|---|
| Lucee | Fully tested (5.4.8.2), including the cbjavaloader + `this.javaSettings` split described in [Getting Started](/projects/coldbox-graphql/docs/getting-started). |
| BoxLang | Fully tested (1.16.0) against a real running server — schema build, resolver wiring (both `PropertyDataFetcher` fallback and explicit-resolver precedence), and a real HTTP round-trip through `POST /graphql` all pass with zero `Application.bx` changes. Requires ColdBox 8+ and TestBox 7+ — those constraints are about ColdBox/TestBox's own BoxLang support, not this module. |
| Adobe ColdFusion | Not tested. ACF supports `createDynamicProxy()`, `this.javaSettings`, and cbjavaloader, so the same Lucee code path should work, but has not been verified. |
