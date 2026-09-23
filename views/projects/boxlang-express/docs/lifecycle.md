# Process Lifecycle

What actually happens on startup, shutdown, a port conflict, and a dev-mode file change.

## Startup: listen() blocks the process

`app.listen()` blocks the calling thread by default (`options.block = true`). Node keeps a CLI process alive via its event loop; BoxLang's CLI runtime has no equivalent, so `listen()` blocks itself rather than requiring every caller to remember a keep-alive loop:

```bxs
app.listen( 3000, ( port ) => println( "listening on #port#" ) )
// process stays alive here until app.close() is called or the process is signaled
```

Pass `{ block: false }` for non-blocking startup — useful for a test suite, or embedding the server inside a larger app that manages its own lifecycle. `app.close()` stops the server either way.

`{ backlog: n }` sets the TCP accept-queue depth (default `1024`), passed through to Undertow's `org.xnio.Options.BACKLOG` — how many pending connections the OS holds before refusing new ones outright, independent of how fast requests are actually handled. This defaults higher than Undertow's own default: a burst of concurrent connections well within what the virtual-thread executor can actually handle could otherwise get refused with a connection reset instead of queued. Rarely needs touching — a reverse proxy in front (already required, since this server never terminates TLS itself) usually queues connections before this limit is reached.

## Monitoring the running server

`app.getConnectorStatistics()` returns live HTTP-layer metrics straight from Undertow's own listener — active connections/requests, total request count, bytes sent/received, error count, processing time. Returns `null` before `listen()` has run or after `close()`.

```bxs
app.get( "/admin/stats", ( req, res ) => {
    res.json( app.getConnectorStatistics() )
} )
```

`listen()` turns on `UndertowOptions.ENABLE_STATISTICS` unconditionally (off by default in Undertow itself, but the per-request tracking overhead is negligible next to everything else already happening per request here) — without it, `getConnectorStatistics()` would just return `null` always instead of real numbers. Useful for a server-monitoring dashboard alongside JVM/OS-level metrics (memory, CPU, GC), which don't see anything at the HTTP layer.

## Request IDs

```bxs
app.set( "requestId", true )
```

Every request gets an id: it's available as `req.id`, echoed on the response as `X-Request-Id`, and added to the request log line and the unhandled-error log line, so one request can be followed across log lines and across nodes behind a load balancer:

```plain
[2026-09-20 21:02:38] [checkout-7f3a] GET /hello 127.0.0.1
```

A well-formed `X-Request-Id` from the client (up to 128 characters of letters, digits, `.`, `_` and `-`) is reused, so an id minted at the edge carries through. Anything else is replaced with a generated one, since it's client-controlled and ends up in logs and a response header. `app.set( "requestIdHeader", "X-Correlation-Id" )` renames the header. Off by default, so existing log output is unchanged.

## Prometheus metrics (app.metrics())

```bxs
app.metrics( { token: getSystemSetting( "METRICS_TOKEN" ), sources: [ stomp ] } )
```

`app.metrics()` adds a Prometheus-format endpoint (default `GET /metrics`) and starts counting requests. Call it before `listen()`, and before `app.use()` if scrapes shouldn't pass through sessions or rate limiting.

| Metric | Type | Meaning |
|---|---|---|
| `boxexpress_http_requests_total{class}` | counter | Requests by status class (`2xx`, `4xx`, …) |
| `boxexpress_http_request_duration_seconds_sum` / `_count` | summary | Total handling time and count, for averages and rates |
| `boxexpress_http_active_connections`, `_active_requests` | gauge | Open connections; requests in flight |
| `boxexpress_http_bytes_received_total`, `_bytes_sent_total` | counter | From Undertow |
| `boxexpress_websocket_connections` | gauge | Open `app.ws()` connections |
| `boxexpress_draining` | gauge | `1` once `app.shutdown()` has begun |
| `boxexpress_scheduler_job_runs_total{job}`, `_failures_total`, `_skipped_total`, `_running` | counter / gauge | Per [scheduled job](/projects/boxlang-express/docs/scheduler) |
| `boxexpress_scheduler_job_last_success_timestamp_seconds{job}`, `_last_duration_seconds` | gauge | Absent until the job has succeeded once |
| `boxexpress_cluster_peers`, `boxexpress_cluster_is_manager` | gauge | With [clustering](/projects/boxlang-express/docs/cluster) on. `is_manager` appears once an election has been checked, and reports the last check rather than triggering one |
| `boxexpress_stomp_connections`, `_subscriptions`, `_messages_published_total`, `_messages_delivered_total` | gauge / counter | For a STOMP broker passed in `sources` |

A scheduled job that has quietly been failing shows up as a rising failure counter and a stale last-success time.

`sources` takes any object with a `getMetrics()` method returning `{ name, type, help, samples: [ { labels, value } ] }`, so your own code can add metrics to the same endpoint. A source that throws is logged and skipped rather than failing the scrape.

`token` requires `Authorization: Bearer <token>`, compared in constant time. The numbers are operational detail, so don't leave the endpoint open on a public listener. Requests made through [`app.inject()`](/projects/boxlang-express/docs/testing) aren't counted.

There are deliberately no per-route latency histograms: raw paths would blow up the number of series, and bucket boundaries are an app-specific choice.

## Health checks (app.health())

```bxs
app.health( { checks: { db: () => pingDatabase() } } )   // register before app.use(...) middleware
```

`app.health()` adds two routes, the shape a load balancer or a Kubernetes `livenessProbe`/`readinessProbe` wants:

- `GET /health/live` — `200` while the process can answer at all.
- `GET /health/ready` — `200` when the app should receive traffic, otherwise `503`.

Each function in `checks` returns `false`, or throws, when that dependency is unhealthy. Readiness then answers `503 { status: "unhealthy", failing: ["db"] }` — the check names, never their exception text (which is logged instead). Readiness also reports `503 { status: "draining" }` the moment a shutdown begins. `path` changes the `/health` prefix.

These are ordinary routes, so register them before any session/CSRF/rate-limit middleware if probes shouldn't pass through it.

## Graceful shutdown (app.shutdown(), Ctrl-C / SIGTERM)

`app.shutdown( { timeoutMs, drainDelayMs } )` stops the app gracefully:

1. Readiness flips to draining straight away.
2. After `drainDelayMs` (default `0` — raise it to give a load balancer time to notice before requests are refused), new requests get a `503` and every open WebSocket connection is closed, firing its `onClose`.
3. Requests already running get up to `timeoutMs` to finish before the server stops regardless.

It returns `{ drained, webSocketsClosed }`; `drained` is `false` if the timeout ran out. A long-lived response such as an SSE stream counts as in flight until it ends, so it uses the whole timeout. `app.close()` is still the immediate stop.

`Ctrl-C` or `SIGTERM` run this too — the server registers a JVM shutdown hook when it starts. `app.set( "shutdownTimeoutMs", ms )` (default `5000`) is the timeout; `0` restores the old immediate stop. Whichever way the process ends, the listening socket is released, the dev-mode file watcher (if enabled) is stopped, and every job registered via [`app.schedule()`](/projects/boxlang-express/docs/scheduler) is cancelled. `close()` itself is safe to call more than once.

In Kubernetes:

```yaml
readinessProbe: { httpGet: { path: /health/ready, port: 3000 }, periodSeconds: 5 }
livenessProbe:  { httpGet: { path: /health/live,  port: 3000 }, periodSeconds: 10 }
terminationGracePeriodSeconds: 30    # comfortably above shutdownTimeoutMs
```

## Port already in use

If the requested port is already bound, the server exits with a short, readable message instead of a raw Java stack trace:

```plain
[BoxExpress] Port 3000 is already in use — exiting.
```

The process exits with status code `1`. This is detected by inspecting the actual `java.net.BindException` cause (not by string-matching the error message), so it's specific to a real port conflict — any other startup failure still surfaces normally.

## Dev-mode auto-reload

```bxs
app.set( "reloadOnChange", true )
```

This watches the current working directory (recursively, skipping dotfiles and directories like `node_modules`/`boxlang_modules`/`target`/`build`/`dist`) for `.bx`/`.bxs` changes, debouncing bursty save events (most editors fire two or three filesystem events per save) into one restart:

1. A file change is detected and debounced (150ms).
2. `[reloadOnChange] <path> changed — restarting...` is logged.
3. The replacement process is launched _first_, replaying the exact original JVM invocation via `ProcessHandle.current()` — this works whatever the entry script is named and however it was launched (bvm-managed `boxlang`, a raw `java -jar`, custom JVM flags), rather than assuming a fixed `boxlang <script>` shape.
4. Only once that launch succeeds is the current server closed (releasing the port) and the old process exits — the new one binds the same port with the updated code.

Registration is a one-time recursive snapshot taken at startup — a directory created _after_ the server starts won't be picked up until the next restart. That's an accepted limitation for a dev-only convenience feature.

`.bxm` view files aren't watched — only `.bx`/`.bxs` are. A restart is only _necessary_ for `app.bxs` itself (or any other `.bx` class file it loads) — that code runs once at process start, so editing `app.get(...)` registrations or anything else at the top level does nothing until the script re-executes. A `.bxm` view is different: `res.render()` runs it via `include`, which re-reads the file from disk on every request as long as `trustedCache` is off (the default) — confirmed directly, editing a view and requesting it again immediately picked up the change with no restart at all, even with `reloadOnChange` turned off entirely. Restarting on a view-only edit isn't wrong, just redundant work the file already didn't need.
