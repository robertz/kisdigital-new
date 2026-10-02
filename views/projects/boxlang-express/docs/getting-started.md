# Getting Started

Install BoxLang Express, write a minimal server, and run it.

## Prerequisites

You need the BoxLang CLI itself installed (e.g. via [bvm](https://bx.dev), the BoxLang version manager).

## Installing BoxLang Express

`box install boxlang-express` or `install-bx-module boxlang-express`

## Your first server

Once the module resolves, `boxExpress()` and its companion middleware BIFs (`boxExpressJSON()`, `boxExpressStatic()`, etc.) are available globally — no `import` needed. Save this as `app.bxs`:

```bxs
app = boxExpress()

app.get( "/", ( req, res ) => {
    res.send( "Hello World" )
} )

app.listen( 3000, ( port ) => {
    println( "listening on #port#" )
} )
```

## Running the server

Run it directly with the CLI:

```bash
boxlang app.bxs
```

By default `app.listen()` blocks the calling thread — it keeps the process alive for you, the same role Node's event loop plays for an Express app, since BoxLang's CLI runtime has no equivalent of its own. Stop it with `Ctrl-C`; see [Health Checks & Graceful Shutdown](/projects/boxlang-express/docs/health-and-shutdown) for exactly what happens on shutdown.

Need a config file (datasources, module settings, etc.)? See [Configuration](/projects/boxlang-express/docs/config) — the CLI doesn't pick one up automatically, so there's a flag for it.

## Dev-mode auto-reload

Add one line to restart the process automatically whenever a watched `.bx`/`.bxs` file changes (`.bxm` views don't need this — they're re-read from disk on every request already):

```bxs
app.set( "reloadOnChange", true )
```

Full mechanics are covered in [Auto-Restart](/projects/boxlang-express/docs/auto-restart).

## Where to go next

The rest of these docs follow the module's own reference, one page per feature:

- **Core** — [App](/projects/boxlang-express/docs/app), [Routing](/projects/boxlang-express/docs/routing), [Request](/projects/boxlang-express/docs/request), [Response](/projects/boxlang-express/docs/response), [Views](/projects/boxlang-express/docs/views), [Error Handling](/projects/boxlang-express/docs/error-handling)
- **Middleware** — [Middleware](/projects/boxlang-express/docs/middleware), [File Uploads](/projects/boxlang-express/docs/uploads), [Sessions](/projects/boxlang-express/docs/sessions), [Security Headers](/projects/boxlang-express/docs/helmet), [CORS](/projects/boxlang-express/docs/cors), [Rate Limiting](/projects/boxlang-express/docs/rate-limiting), [CSRF Protection](/projects/boxlang-express/docs/csrf)
- **Realtime and background work** — [Server-Sent Events](/projects/boxlang-express/docs/sse), [WebSockets](/projects/boxlang-express/docs/websockets), [STOMP](/projects/boxlang-express/docs/stomp), [Scheduler](/projects/boxlang-express/docs/scheduler), [Cluster Support](/projects/boxlang-express/docs/cluster)
- **Operations** — [Testing](/projects/boxlang-express/docs/testing), [Observability](/projects/boxlang-express/docs/observability), [Health Checks & Graceful Shutdown](/projects/boxlang-express/docs/health-and-shutdown), [Auto-Restart](/projects/boxlang-express/docs/auto-restart)
- **Project** — [BoxLang Gotchas](/projects/boxlang-express/docs/gotchas), [Hacking on BoxExpress](/projects/boxlang-express/docs/development)
