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

## Graceful shutdown (Ctrl-C / SIGTERM)

The server registers a JVM shutdown hook when it starts, so `Ctrl-C` or `SIGTERM` always triggers a clean `close()` — the listening socket is released and the dev-mode file watcher (if enabled) is stopped, whichever way the process ends. `close()` itself is safe to call more than once.

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
