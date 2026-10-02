# Observability

Request IDs with `app.set( "requestId", true )`, and a Prometheus metrics endpoint with `app.metrics()`.

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

## Connector statistics

For the same HTTP-layer numbers as a struct rather than a scrape endpoint — a monitoring page inside your own app, say — see `app.getConnectorStatistics()` under [App](/projects/boxlang-express/docs/app#monitoring-the-running-server).
