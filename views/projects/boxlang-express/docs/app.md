# App

The `app` object: registering routes and middleware, settings, and starting and stopping the server.

## Creating an app

```bxs
app = boxExpress()
```

`boxExpress()` is a global function the module registers the moment it loads — no `new` or namespace needed. It's a thin wrapper: `new bxModules.boxexpress.models.BoxExpress()` works identically if you'd rather be explicit about where it comes from.

## What's on the app object

| Method | Purpose |
|---|---|
| `app.get/post/put/patch/delete/head/all(path, ...handlers)` | Register a route — see [Routing](/projects/boxlang-express/docs/routing) |
| `app.use(handler)` / `app.use(path, handler)` / `app.use(path, router)` | Register middleware or mount a router — see [Middleware](/projects/boxlang-express/docs/middleware) |
| `app.param(name, callback)` | Run a callback for a route param — see [Routing](/projects/boxlang-express/docs/routing#param-callbacks) |
| `app.route(path)` | Chain several methods on one path — see [Routing](/projects/boxlang-express/docs/routing#chaining-with-route) |
| `app.set(name, value)` / `app.getSetting(name)` | App-level settings — see [Configuration](/projects/boxlang-express/docs/config#app-level-settings) |
| `app.locals` | A plain struct merged into every `res.render()` call's data — see [Views](/projects/boxlang-express/docs/views) |
| `app.listen(port, callback, options)` | Starts the server and blocks the calling thread by default |
| `app.close()` | Stops the server, and breaks a blocked `listen()` (from any thread) |
| `app.getConnectorStatistics()` | Live HTTP-layer metrics from Undertow's listener |
| `app.ws(path, callback)` | WebSocket routes — see [WebSockets](/projects/boxlang-express/docs/websockets) |
| `app.schedule(intervalMs, callback, options)` / `app.getScheduledJobs()` | Fixed-interval recurring jobs — see [Scheduler](/projects/boxlang-express/docs/scheduler) |
| `app.getClusterManager()` | Cross-process peer discovery, manager election and the STOMP relay mesh — see [Cluster Support](/projects/boxlang-express/docs/cluster) |
| `app.inject(options)` | Run a request through the app without a server — see [Testing](/projects/boxlang-express/docs/testing) |
| `app.metrics(options)` | A Prometheus endpoint — see [Observability](/projects/boxlang-express/docs/observability) |
| `app.health(options)` / `app.shutdown(options)` | Probes and graceful shutdown — see [Health Checks & Graceful Shutdown](/projects/boxlang-express/docs/health-and-shutdown) |

## Starting the server: listen() blocks the process

`app.listen()` blocks the calling thread by default (`options.block = true`). Node keeps a CLI process alive via its event loop; BoxLang's CLI runtime has no equivalent, so `listen()` blocks itself rather than requiring every caller to remember a keep-alive loop:

```bxs
app.listen( 3000, ( port ) => println( "listening on #port#" ) )
// process stays alive here until app.close() is called or the process is signaled
```

Pass `{ block: false }` for non-blocking startup — useful for a test suite, or embedding the server inside a larger app that manages its own lifecycle. `app.close()` stops the server either way.

`{ backlog: n }` sets the TCP accept-queue depth (default `1024`), passed through to Undertow's `org.xnio.Options.BACKLOG` — how many pending connections the OS holds before refusing new ones outright, independent of how fast requests are actually handled. This defaults higher than Undertow's own default: a burst of concurrent connections well within what the virtual-thread executor can actually handle could otherwise get refused with a connection reset instead of queued. Rarely needs touching — a reverse proxy in front (already required, since this server never terminates TLS itself) usually queues connections before this limit is reached.

`close()` works either way, and — since it just flips a flag `listen()`'s loop polls every second — also works when called from a _different_ thread than the one blocked in `listen()`, e.g. a `/shutdown` route handler running on its own virtual thread.

## Request logging

Every request gets a line on stdout as soon as it's received:

```plain
[2026-08-10 10:45:41] GET /users/42 127.0.0.1
```

Turn it off with `app.set( "log", false )` — useful for a high-throughput deployment that doesn't want a synchronous stdout write on every request. With [request IDs](/projects/boxlang-express/docs/observability) on, the id is added to the line.

## Monitoring the running server

`app.getConnectorStatistics()` returns live HTTP-layer metrics straight from Undertow's own listener — active connections/requests, total request count, bytes sent/received, error count, processing time. Returns `null` before `listen()` has run or after `close()`.

```bxs
app.get( "/admin/stats", ( req, res ) => {
    res.json( app.getConnectorStatistics() )
} )
```

`listen()` turns on `UndertowOptions.ENABLE_STATISTICS` unconditionally (off by default in Undertow itself, but the per-request tracking overhead is negligible next to everything else already happening per request here) — without it, `getConnectorStatistics()` would just return `null` always instead of real numbers. Useful for a server-monitoring dashboard alongside JVM/OS-level metrics (memory, CPU, GC), which don't see anything at the HTTP layer.

## Port already in use

If the requested port is already bound, the server exits with a short, readable message instead of a raw Java stack trace:

```plain
[BoxExpress] Port 3000 is already in use — exiting.
```

The process exits with status code `1`. This is detected by inspecting the actual `java.net.BindException` cause (not by string-matching the error message), so it's specific to a real port conflict — any other startup failure still surfaces normally.

## Register everything before listen()

Register all routes and middleware _before_ calling `listen()`. The route table isn't synchronized, so mutating it while requests are already being served concurrently (each on its own virtual thread) isn't supported.
