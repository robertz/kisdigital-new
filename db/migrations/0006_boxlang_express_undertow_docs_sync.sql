-- Sync two boxlang-express project-doc pages with the JDK-to-Undertow
-- migration and reloadOnChange fix landed upstream (robertz/boxlang-express
-- commits 9c8a3b9, 1425d73, 41479d7, 6e35d85, ccfe752):
--
--  * lifecycle: the backlog paragraph described the JDK HttpServer's
--    accept-queue behavior and a JDK-specific load-test measurement; the
--    server now talks to Undertow exclusively (the JDK engine and its
--    HttpServerAdapter seam were removed), so backlog is now set via
--    Undertow's org.xnio.Options.BACKLOG. Also dropped `.bxm` from the
--    reloadOnChange watched-extensions list — FileWatcher.bx stopped
--    watching `.bxm` a few commits before this was written up, so the
--    page contradicted itself (watch-list said .bxm, but the very next
--    paragraph already correctly explained why .bxm doesn't need a
--    restart).
--  * static-files: documents the new directory-without-trailing-slash
--    redirect (301 to the slash-suffixed URL, matching express.static()),
--    which shipped with no doc coverage at all.
--
-- Content authored to match this table's existing voice; verified against
-- the actual current source (models/BoxExpress.bx, models/FileWatcher.bx,
-- models/middleware/StaticFiles.bx), not just the upstream README.

UPDATE `ProjectDoc`
SET `body` = '# Process Lifecycle

What actually happens on startup, shutdown, a port conflict, and a dev-mode file change.

## Startup: listen() blocks the process

`app.listen()` blocks the calling thread by default (`options.block = true`). Node keeps a CLI process alive via its event loop; BoxLang\'s CLI runtime has no equivalent, so `listen()` blocks itself rather than requiring every caller to remember a keep-alive loop:

```bxs
app.listen( 3000, ( port ) => println( "listening on #port#" ) )
// process stays alive here until app.close() is called or the process is signaled
```

Pass `{ block: false }` for non-blocking startup — useful for a test suite, or embedding the server inside a larger app that manages its own lifecycle. `app.close()` stops the server either way.

`{ backlog: n }` sets the TCP accept-queue depth (default `1024`), passed through to Undertow\'s `org.xnio.Options.BACKLOG` — how many pending connections the OS holds before refusing new ones outright, independent of how fast requests are actually handled. This defaults higher than Undertow\'s own default: a burst of concurrent connections well within what the virtual-thread executor can actually handle could otherwise get refused with a connection reset instead of queued. Rarely needs touching — a reverse proxy in front (already required, since this server never terminates TLS itself) usually queues connections before this limit is reached.

## Graceful shutdown (Ctrl-C / SIGTERM)

The server registers a JVM shutdown hook when it starts, so `Ctrl-C` or `SIGTERM` always triggers a clean `close()` — the listening socket is released and the dev-mode file watcher (if enabled) is stopped, whichever way the process ends. `close()` itself is safe to call more than once.

## Port already in use

If the requested port is already bound, the server exits with a short, readable message instead of a raw Java stack trace:

```plain
[BoxExpress] Port 3000 is already in use — exiting.
```

The process exits with status code `1`. This is detected by inspecting the actual `java.net.BindException` cause (not by string-matching the error message), so it\'s specific to a real port conflict — any other startup failure still surfaces normally.

## Dev-mode auto-reload

```bxs
app.set( "reloadOnChange", true )
```

This watches the current working directory (recursively, skipping dotfiles and directories like `node_modules`/`boxlang_modules`/`target`/`build`/`dist`) for `.bx`/`.bxs` changes, debouncing bursty save events (most editors fire two or three filesystem events per save) into one restart:

1. A file change is detected and debounced (150ms).
2. `[reloadOnChange] <path> changed — restarting...` is logged.
3. The replacement process is launched _first_, replaying the exact original JVM invocation via `ProcessHandle.current()` — this works whatever the entry script is named and however it was launched (bvm-managed `boxlang`, a raw `java -jar`, custom JVM flags), rather than assuming a fixed `boxlang <script>` shape.
4. Only once that launch succeeds is the current server closed (releasing the port) and the old process exits — the new one binds the same port with the updated code.

Registration is a one-time recursive snapshot taken at startup — a directory created _after_ the server starts won\'t be picked up until the next restart. That\'s an accepted limitation for a dev-only convenience feature.

`.bxm` view files aren\'t watched — only `.bx`/`.bxs` are. A restart is only _necessary_ for `app.bxs` itself (or any other `.bx` class file it loads) — that code runs once at process start, so editing `app.get(...)` registrations or anything else at the top level does nothing until the script re-executes. A `.bxm` view is different: `res.render()` runs it via `include`, which re-reads the file from disk on every request as long as `trustedCache` is off (the default) — confirmed directly, editing a view and requesting it again immediately picked up the change with no restart at all, even with `reloadOnChange` turned off entirely. Restarting on a view-only edit isn\'t wrong, just redundant work the file already didn\'t need.',
    `last_updated` = NOW()
WHERE `id` = 'b02e117a-dee1-4d60-8bfd-c9daec2df2be';

UPDATE `ProjectDoc`
SET `body` = '# Static Files & Uploads

Serving a directory of static assets, sending individual files, and handling multipart uploads.

## Serving a static directory

```bxs
app.use( "/public", boxExpressStatic( expandPath( "./public" ) ) )
// GET /public/logo.png → serves ./public/logo.png
```

Mount it with no prefix to serve straight from the site root:

```bxs
app.use( boxExpressStatic( expandPath( "./public" ) ) )
// GET /logo.png → serves ./public/logo.png
```

A request for a file that doesn\'t exist under the served directory falls through to `next()` rather than erroring — your other routes (or the default 404) still get a chance to handle it.

## Directory requests without a trailing slash

A request that resolves to a directory but is missing its trailing slash (e.g. `/public/docs` when `./public/docs/index.html` exists) gets a `301` redirect to the slash-suffixed URL instead of a 404 — the same behavior as `express.static()`. The slash-suffixed URL is the canonical one: relative asset links inside the served HTML resolve correctly against it and wouldn\'t against the bare path.

```bxs
app.use( "/public", boxExpressStatic( expandPath( "./public" ) ) )
// GET /public/docs   → 301 to /public/docs/
// GET /public/docs/  → serves ./public/docs/index.html
```

## Conditional GET (ETag / 304)

Static file responses automatically set `ETag` and `Last-Modified`, and honor `If-None-Match` — a matching request gets a `304 Not Modified` with no body, instead of re-sending the file. The same conditional-GET support applies to `res.sendFile()`.

## Cache-Control (options.maxAge)

Both accept `options.maxAge` (seconds) to also set `Cache-Control: public, max-age=<n>`, letting a browser skip revalidation entirely for that long instead of asking on every request. Off by default — no header at all unless asked for:

```bxs
app.use( "/public", boxExpressStatic( expandPath( "./public" ), { maxAge: 86400 } ) )  // 1 day

app.get( "/report", ( req, res ) => {
    res.sendFile( expandPath( "./reports/latest.pdf" ), { maxAge: 3600 } )  // 1 hour
} )
```

## HEAD requests

`HEAD /public/logo.png` returns the same headers a `GET` would — `Content-Type`, `Content-Length`, `ETag`, `Last-Modified` — with no response body. See [Routing](/projects/boxlang-express/docs/routing) for how `HEAD` works across the framework generally.

## Range requests (partial content)

Both static file serving and `res.sendFile()`/`download()` honor a `Range` request header and respond `206 Partial Content` with just the requested slice — what makes video/audio scrubbing and resumable downloads work, since the client doesn\'t have to (re-)download the whole file to seek or resume. Every file response sets `Accept-Ranges: bytes`, even a full `200`, so a client knows it can send a `Range` request on a later one:

```bash
curl -H "Range: bytes=0-1023" localhost:3000/public/video.mp4
# -> 206, Content-Range: bytes 0-1023/<total>, body is just those 1024 bytes
```

A range starting beyond the file\'s size gets a `416 Range Not Satisfiable` with `Content-Range: bytes */<total>` and no body. Two things are out of scope, the trade-off most minimal static-file servers make: a request naming more than one range falls back to a full `200` response instead of a `multipart/byteranges` reply, and `If-Range` (a conditional range against a validator) isn\'t supported — a `Range` request is always attempted regardless of freshness.

## Sending a single file from a route

```bxs
app.get( "/report", ( req, res ) => {
    res.sendFile( expandPath( "./reports/latest.pdf" ) )
} )

app.get( "/report/download", ( req, res ) => {
    res.download( expandPath( "./reports/latest.pdf" ), "report.pdf" )
} )
```

`res.download()` is `sendFile()` with `Content-Disposition: attachment` forced, defaulting the downloaded filename to the source file\'s own name if you don\'t pass one. A caller-supplied filename is sanitized — quote and control characters are stripped so it can\'t inject extra `Content-Disposition` parameters.

When building a file path from user input (e.g. a route param), pass `options.root` to sandbox it — a resolved path that escapes `root` is rejected rather than served:

```bxs
app.get( "/files/:name", ( req, res ) => {
    res.sendFile( req.params.name, { root: expandPath( "./uploads" ) } )
} )
```

## Handling uploads

```bxs
app.post(
    "/upload",
    boxExpressUpload( { dest: expandPath( "./uploads" ) } ),
    ( req, res ) => {
        res.json( { fields: req.body, files: req.files } )
    }
)
```

`boxExpressUpload()` parses a `multipart/form-data` request: non-file fields land in `req.body` same as any other body parser. `req.files` is a struct keyed by field name, each value an _array_ of file structs — a field can carry more than one file — with shape `{ fieldName, filename, contentType, size, buffer, path }`. `path` is only present when `dest` was given; the client-supplied filename is never used to build it, sidestepping path-traversal/collision entirely.

```bxs
app.get( "/uploaded-avatar", ( req, res ) => {
    res.json( {
        filename: req.files.avatar[ 1 ].filename,
        size: req.files.avatar[ 1 ].size,
        savedAt: req.files.avatar[ 1 ].path
    } )
} )
```

> [!WARNING] No live demo on this site
> This documentation section is read-only — there\'s no working upload form wired up here to try. The code above is exactly what the API supports; wire it into your own app to see it in action.',
    `last_updated` = NOW()
WHERE `id` = 'ccef6df3-7e12-4174-b22e-7ed77bf4fe86';
