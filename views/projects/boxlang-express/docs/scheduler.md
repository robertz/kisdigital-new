# Scheduler

`app.schedule(intervalMs, callback, options)` — fixed-interval recurring jobs.

## Registering a job

```bxs
app.schedule( 60000, () => {
    cleanupExpiredSessions()
} )
```

This is the `setInterval` equivalent, not a cron scheduler — deliberately no cron-expression parsing in this pass (see the non-goals below). Lazily creates one internal `Scheduler` instance on the first call; an app that never calls `schedule()` pays nothing for it.

## Job handles and self-cancelling jobs

`schedule()` returns a job handle — `{ cancel(), name }` — the same handle passed as the callback's own (optional) argument, so a job that needs to stop itself doesn't have to hang onto the return value of `schedule()` to do it:

```bxs
app.schedule( 60000, ( job ) => {
    if ( shouldStopPolling() ) {
        job.cancel()
    }
}, { name: "poll-external-api", immediate: true } )
```

## Options

| Option | Default | Effect |
|---|---|---|
| `name` | an internal id like `"job-3"` | Labels the job for `getScheduledJobs()` and the `[Scheduler] job '...' threw` error log |
| `immediate` | `false` | Runs the first tick right away instead of waiting a full interval first |
| `allowOverlap` | `false` | Whether a tick that comes due while the previous run is still in flight should run anyway |

`allowOverlap: false` (the default) skips a tick entirely — not queued, not delayed — rather than letting an occasionally-slow job (a slow query, a network call) pile up an unbounded number of concurrent runs. Pass `allowOverlap: true` only for a job that's actually safe to run concurrently with itself.

## Threading and error handling

Every job's tick is driven by one shared `ScheduledExecutorService` per app, but each tick's actual callback runs on its own virtual thread — the same request/job-body split `app.listen()` already uses for HTTP requests — so a slow job never delays another job's tick, and a slow tick of one job never delays another job's tick either.

A thrown error inside a job is caught and logged (`[Scheduler] job 'name' threw: ...`), never left to kill future ticks of that job or any other — same posture as the STOMP broker's server-side listener guard (see [WebSockets](/projects/boxlang-express/docs/websockets)).

## Introspection and shutdown

```bxs
app.get( "/admin/jobs", ( req, res ) => {
    res.json( app.getScheduledJobs() )
} )
```

`app.getScheduledJobs()` returns a struct of live job state (`name`, `allowOverlap`, `running`) — an introspection getter for debugging/ops, not a stable data API to build app logic against, same pattern as the STOMP broker's `getConnections()`/`getSubscriptions()`.

`app.close()` cancels every job and shuts the scheduler down, the same teardown block that already stops the reload watcher and the HTTP server — no separate cleanup call needed.

## What's not built

Explicit non-goals for this first version:

- **No cron-expression parsing** — fixed-interval only.
- **No persistence across restarts** — in-memory only, single process; a restart forgets every scheduled job.
- **No missed-run catch-up** after downtime.

To run a job exactly once across a cluster of instances instead of once per instance, pass `{ clustered: true }` — see [Cluster Support](/projects/boxlang-express/docs/cluster).

If what you actually need is push messaging rather than periodic polling — notifying connected clients when something happens — see [WebSockets](/projects/boxlang-express/docs/websockets) instead.
