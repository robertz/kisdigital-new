# Getting Started

Install the module and set up the required classpath step for your engine.

## Installation

```bash
box install coldbox-graphql
```

The HTTP route is registered automatically at startup, mirroring whatever you set as `basePath` (default `/graphql`) — nothing to wire up.

Depends on [cbjavaloader](https://forgebox.io/view/cbjavaloader) to load its vendored jars (graphql-java, v26.0) at boot.

## BoxLang 1.8.0+

Nothing else to do. cbjavaloader uses BoxLang's native request classloader, so the module loads and wires everything — including implementing `graphql.schema.DataFetcher` from your resolver CFCs — without touching `Application.bx`. Verified end-to-end on BoxLang 1.16.0 with zero `Application.bx` changes: schema build, explicit-resolver precedence, `PropertyDataFetcher` fallback, and a real HTTP round-trip through `POST /graphql` all pass.

> [!WARNING] ColdBox/TestBox versions matter here
> ColdBox 7.5.2 does not boot cleanly on BoxLang 1.16.0 (an internal interceptor-metadata mismatch fails before any module even loads) — use **ColdBox 8+** with BoxLang. Likewise TestBox needs **7+** for BoxLang (5.x assumes a `server.coldfusion` key that doesn't exist on BoxLang's `server` scope). Neither is specific to this module; both will block you before you get anywhere near it.

## Lucee / Adobe ColdFusion — one required step

In your app's `Application.cfc`:

```cfscript
this.javaSettings = {
    loadPaths               : [ "/modules_app/coldbox-graphql/lib" ], // adjust to your module install path
    loadColdFusionClassPath : true,
    reloadOnChange          : false
};
```

This is required because `createDynamicProxy()` — used to implement `graphql.schema.DataFetcher` from your resolver CFCs — has no per-call classpath override the way `createObject()` or cbjavaloader do; it can only resolve interfaces already on the real application classpath.

This isn't a config choice within the module's control: on these two engines, cbjavaloader loads jars into an _isolated_ classloader, and mixing objects from that loader with a `createDynamicProxy()` result throws a "No matching Method/Function" error at the first point they interact — same class, same jar, but two different classloaders producing incompatible runtime types (confirmed empirically while building this). So on Lucee/ACF the module uses plain `createObject()` exclusively instead — cbjavaloader is still loaded as a dependency but genuinely unused for object creation on these two engines — and that requires the classes on the real classpath via `this.javaSettings`.
