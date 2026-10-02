# Health Checks & Graceful Shutdown

`app.health()` for load balancer and Kubernetes probes, and `app.shutdown()` for stopping without dropping requests.

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
