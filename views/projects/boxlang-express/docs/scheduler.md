# Scheduler

`app.schedule(intervalMs, callback, options)` — fixed-interval recurring jobs.

## Registering a job

```bxs
app.schedule( 60000, () => {
    cleanupExpiredSessions()
} )
```

This is the `setInterval` equivalent; to run at clock times instead, pass a cron expression — see [Cron schedules](#cron-schedules) below. Lazily creates one internal `Scheduler` instance on the first call; an app that never calls `schedule()` pays nothing for it.

`intervalMs` must be a whole number of milliseconds, 1 or more; anything else throws `BoxExpress.InvalidArgument` and nothing is scheduled. `schedule()` is safe to call from concurrent requests, and after `app.close()` it throws `BoxExpress.AppClosed`.

## Job handles and self-cancelling jobs

`schedule()` returns a job handle — `{ cancel(), name }` — the same handle passed as the callback's own (optional) argument, so a job that needs to stop itself doesn't have to hang onto the return value of `schedule()` to do it:

```bxs
app.schedule( 60000, ( job ) => {
    if ( shouldStopPolling() ) {
        job.cancel()
    }
}, { name: "poll-external-api", immediate: true } )
```

A job can cancel itself at any time, including from inside its first `immediate: true` run, before `schedule()` has returned.

## Options

| Option | Default | Effect |
|---|---|---|
| `name` | an internal id like `"job-3"` | Labels the job for `getScheduledJobs()` and the `[Scheduler] job '...' threw` error log |
| `immediate` | `false` | Runs the first tick right away instead of waiting a full interval first |
| `allowOverlap` | `false` | Whether a tick that comes due while the previous run is still in flight should run anyway |
| `clustered` | `false` | Runs the job on only one instance of a cluster — see [Cluster Support](/projects/boxlang-express/docs/cluster) |
| `stallThresholdMs` | 10x the interval, at least 30000 | How long a run may stay active before it's treated as hung (see below) |

`allowOverlap: false` (the default) skips a tick entirely — not queued, not delayed — rather than letting an occasionally-slow job (a slow query, a network call) pile up an unbounded number of concurrent runs. Pass `allowOverlap: true` only for a job that's actually safe to run concurrently with itself.

## Threading and error handling

Every job's tick is driven by one shared `ScheduledExecutorService` per app, but each tick's actual callback runs on its own virtual thread — the same request/job-body split `app.listen()` already uses for HTTP requests — so a slow job never delays another job's tick, and a slow tick of one job never delays another job's tick either.

A thrown error inside a job is caught and logged (`[Scheduler] job 'name' threw: ...`), never left to kill future ticks of that job or any other — same posture as the STOMP broker's server-side listener guard (see [STOMP](/projects/boxlang-express/docs/stomp)).

A job body that never returns at all (blocks forever with no timeout of its own) is a separate failure mode from a thrown error — nothing throws, so the catch above never fires, and with `allowOverlap: false` every future tick would otherwise be skipped forever thinking the previous run is still in flight. A stall watchdog guards against this: once a run has been active longer than its stall threshold (`stallThresholdMs`, default 10x the interval with a 30s minimum), the next tick logs it and starts a new run in its place. Each run owns the job by id, so if the hung run does return later it doesn't clear the new run's active state, and the overlap guard still holds.

## Introspection and shutdown

```bxs
app.get( "/admin/jobs", ( req, res ) => {
    res.json( app.getScheduledJobs() )
} )
```

`app.getScheduledJobs()` returns a struct of live job state (`name`, `allowOverlap`, `clustered`, `running`, where `running` counts runs actually in flight) — an introspection getter for debugging/ops, not a stable data API to build app logic against, same pattern as the STOMP broker's `getConnections()`/`getSubscriptions()`.

`app.close()` cancels every job and shuts the scheduler down, the same teardown block that already stops the reload watcher and the HTTP server — no separate cleanup call needed.

## Cron schedules

Pass a cron expression instead of an interval to run a job at clock times — "every night at 2", "every 15 minutes during office hours":

```bxs
app.schedule( "0 2 * * *", () => purgeOldUploads(), { name: "nightly-purge" } )
app.schedule( "*/15 9-17 * * MON-FRI", () => syncInventory() )
app.schedule( "0 9 1 * *", () => sendInvoices(), { timezone: "America/New_York" } )
```

Five fields, in the usual order:

| Field | Values |
|---|---|
| minute | `0`-`59` |
| hour | `0`-`23` |
| day of month | `1`-`31` |
| month | `1`-`12` or `JAN`-`DEC` |
| day of week | `0`-`7` or `SUN`-`SAT` (`0` and `7` are both Sunday) |

Each field takes `*`, a single value, a range (`9-17`), a list (`1,15`), and a step (`*/15`, `10-40/5`, or `5/20` for "from 5, every 20"). A sixth field in front adds seconds (`*/10 * * * * *` is every ten seconds). `@hourly`, `@daily`, `@weekly`, `@monthly` and `@yearly` are shorthands.

When both day-of-month and day-of-week are restricted, the job runs on a day matching *either* — `0 0 1,15 * MON` is the 1st, the 15th, and every Monday. That's the standard cron rule, and it surprises people.

Times are in the server's timezone unless `options.timezone` names another (`"UTC"`, `"Europe/London"`). On the day the clocks go forward, a time in the skipped hour doesn't run that day; on the day they go back, a time in the repeated hour runs twice. Schedule in `"UTC"` if either matters.

An expression that's malformed, names an unknown timezone, or can never fire (`0 0 30 2 *`) throws `BoxExpress.InvalidArgument` from `schedule()`. Everything else works as for an interval job: the handle and `job.cancel()`, `name`, `allowOverlap`, `clustered`, and `immediate` (which runs the job once right away *as well as* on its schedule). `getScheduledJobs()` reports a cron job's expression as `cron` and when it next fires as `nextRun`.

Still true of cron jobs: nothing is persisted, and a run that was due while the process was down is not made up afterwards. A job that must not be missed needs a durable queue, not an in-process timer.

## What's not built

Explicit non-goals:

- **No persistence across restarts** — in-memory only, single process; a restart forgets every scheduled job.
- **No missed-run catch-up** after downtime.

To run a job exactly once across a cluster of instances instead of once per instance, pass `{ clustered: true }` — see [Cluster Support](/projects/boxlang-express/docs/cluster).

If what you actually need is push messaging rather than periodic polling — notifying connected clients when something happens — see [WebSockets](/projects/boxlang-express/docs/websockets) instead.
