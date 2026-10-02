# Response

The `res.*` API available inside every handler, including sending files and range requests.

## The response object

Every terminal method funnels through the same internal path that writes headers and body exactly once and closes the exchange — calling two of them on the same response throws.

| Method | Description |
|---|---|
| `res.send(data)` | Sends a string body (or delegates to `res.json()` for structs/arrays) |
| `res.json(data)` | Serializes and sends with `Content-Type: application/json` |
| `res.status(code)` | Sets the status code — chainable |
| `res.sendStatus(code)` | Sends a status with its reason phrase as the body (e.g. `"Not Found"`) |
| `res.set(name, value)` / `res.header(name, value)` | Sets an arbitrary response header — aliases of each other |
| `res.type(mimeType)` | Sets `Content-Type` |
| `res.cookie(name, value, options)` | Sets a `Set-Cookie` header — options: `path`, `maxAge`, `httpOnly` (default true), `secure`, `sameSite` |
| `res.redirect(url, code = 302)` | Sends a redirect with a caller-supplied status code |
| `res.end(data = "")` | Ends the response with an optional body, no content-type inference |
| `res.sendBytes(bytes, contentType)` | Sends raw bytes with an explicit content type, bypassing the string/UTF-8 round trip |
| `res.sendFile(path, options)` | Sends a file inline, with ETag/Last-Modified 304 support; `options.root` sandboxes the path against directory-escape |
| `res.download(path, filename)` | `sendFile()` that forces `Content-Disposition: attachment` |
| `res.render(view, data)` | Renders a view — see [Views](/projects/boxlang-express/docs/views) |
| `res.sse(callback)` | Opens a long-lived Server-Sent Events stream — see [Server-Sent Events](/projects/boxlang-express/docs/sse) |
| `res.dump(data)` | Sends BoxLang's rich, collapsible `dump()` HTML view of a variable as the response — useful for quick debugging routes |
| `res.getStatusCode()` | Returns the eventual status code — reflects the real outcome even when a route never called `status()` directly, since every non-`200` terminal method routes through it internally. For request-logging middleware registered first via `app.use()`, which otherwise can't observe a request's outcome |
| `res.getBytesWritten()` | Returns the body byte count sent so far; `0` for a response still in flight |
| `res.onBeforeSend(callback)` | Registers a callback that runs once, synchronously, the instant before headers are flushed — the last point guaranteed to run after every downstream handler but still early enough to add a header |

## Header value validation

`res.set()`/`res.header()` and `res.cookie()` refuse a value containing CR/LF, any other control character, or a character above Latin-1 — the request fails with a 500 (`BoxExpress.InvalidHeaderValue`) instead of sending the header. Undertow narrows each header character to 8 bits when writing (CVE-2026-19879, no upstream fix yet), which would turn something like U+010A into a bare line feed and open the door to header injection. Tab and printable Latin-1 pass through untouched. If a header value is built from user input, this is the guard that keeps it from splitting the response.

## Examples

```bxs
app.get( "/headers-demo", ( req, res ) => {
    res.header( "X-Powered-By", "BoxLang Express" )
       .type( "text/plain" )
       .send( "check the headers" )
} )

app.get( "/moved", ( req, res ) => {
    res.redirect( "/new-location", 301 )
} )

app.get( "/debug", ( req, res ) => {
    res.dump( req.query )
} )
```

## Sending files

`res.sendFile(path, options)` streams a file from disk, guessing its `Content-Type` from the extension (override with `options.contentType`):

```bxs
app.get( "/report", ( req, res ) => {
    res.sendFile( expandPath( "./reports/latest.pdf" ) )
} )

app.get( "/report/download", ( req, res ) => {
    res.download( expandPath( "./reports/latest.pdf" ), "report.pdf" )
} )
```

`res.download()` is `sendFile()` with `Content-Disposition: attachment` forced, defaulting the downloaded filename to the source file's own name if you don't pass one. A caller-supplied filename is sanitized — quote and control characters are stripped so it can't inject extra `Content-Disposition` parameters.

When building a file path from user input (e.g. a route param), pass `options.root` to sandbox it — a resolved path that escapes `root` is rejected rather than served:

```bxs
app.get( "/files/:name", ( req, res ) => {
    res.sendFile( req.params.name, { root: expandPath( "./uploads" ) } )
} )
```

Files are streamed rather than read into memory, so a large file costs the same memory as a small one and files over 2 GB work.

### Conditional GET (ETag / 304)

`res.sendFile()` sets `ETag` and `Last-Modified` on every response, and answers a conditional request (`If-None-Match` or, failing that, `If-Modified-Since`) with an empty `304 Not Modified` instead of re-sending the file — so a browser's normal caching just works. The `ETag` is a cheap weak tag (`W/"<size>-<mtime>"`, no file hash), so it changes whenever the file's size or modified time changes on disk.

### Cache-Control (options.maxAge)

`options.maxAge` (seconds) sets `Cache-Control: public, max-age=<n>`, letting a browser skip revalidation entirely for that long. Off by default — no header at all unless asked for:

```bxs
app.get( "/report", ( req, res ) => {
    res.sendFile( expandPath( "./reports/latest.pdf" ), { maxAge: 3600 } )  // 1 hour
} )
```

The same options apply to static file serving — see [Middleware](/projects/boxlang-express/docs/middleware#serving-static-files).

## Range requests (partial content)

Both static file serving and `res.sendFile()`/`download()` honor a `Range` request header and respond `206 Partial Content` with just the requested slice — what makes video/audio scrubbing and resumable downloads work, since the client doesn't have to (re-)download the whole file to seek or resume. Every file response sets `Accept-Ranges: bytes`, even a full `200`, so a client knows it can send a `Range` request on a later one:

```bash
curl -H "Range: bytes=0-1023" localhost:3000/public/video.mp4
# -> 206, Content-Range: bytes 0-1023/<total>, body is just those 1024 bytes
```

A range starting beyond the file's size gets a `416 Range Not Satisfiable` with `Content-Range: bytes */<total>` and no body. Two things are out of scope, the trade-off most minimal static-file servers make: a request naming more than one range falls back to a full `200` response instead of a `multipart/byteranges` reply, and `If-Range` (a conditional range against a validator) isn't supported — a `Range` request is always attempted regardless of freshness.

## Tips & Tricks: res.dump()

`res.dump()` is BoxLang's own rich, interactive `dump()` — the same one you'd get from a CLI script — rendered as the HTTP response instead of printed to the console. A few things worth knowing:

### It's a terminal method — dump one thing

Like `res.send()`/`res.json()`, `res.dump()` writes the response and closes the exchange — nothing can be sent after it. To inspect several things at once, wrap them in a single struct rather than calling it more than once:

```bxs
app.get( "/debug", ( req, res ) => {
    res.dump( {
        query: req.query,
        params: req.params,
        headers: req.headers,
        session: req.session
    } )
} )
```

### It's click-to-expand

The rendered dump isn't static markup — struct/array row headers are clickable (and keyboard-focusable) to toggle that branch open or closed, so a large dump doesn't have to be read top-to-bottom. Handy for a deeply nested `req.session` or a big query result.

### Gate debug routes behind your env setting

A dump can expose more than you'd want a stranger to see — internal struct shapes, full session contents, request headers. Guard debug-only routes the same way the framework's own error pages decide whether to reveal a real error message (see [Error Handling](/projects/boxlang-express/docs/error-handling)):

```bxs
app.get( "/debug/session", ( req, res, next ) => {
    if ( app.getSetting( "env" ) != "development" ) {
        next() // fall through to the normal 404 — don't reveal the route exists
        return
    }
    res.dump( req.session )
} )
```

### Reach for more control when you need it

`res.dump()` is a thin convenience wrapper — it only forwards the value to dump, not the underlying `dump()` BIF's other options. The BIF itself supports several worth knowing about when you need more than the default view:

| Argument | Effect |
|---|---|
| `label` | Adds a titled banner above the dump — useful to tell two dumps apart on the same page |
| `expand = false` | Renders every branch collapsed by default instead of open — the single biggest win for a large struct or query result |
| `top = n` | Limits how many levels deep the dump descends before truncating — shrinks the payload for deeply nested data |

Since `res.dump()` doesn't expose these, write the same temp-file round trip it uses internally in your own route when you need them — `dump()`'s HTML output only ever reaches the process console under BoxLang Express's CLI-based HTTP server, so routing it through a temp file and reading it back is what makes it show up in the response at all:

```bxs
app.get( "/debug/session", ( req, res ) => {
    var tmpFile = getTempDirectory() & "dump-" & createUUID() & ".html"
    dump(
        var = req.session,
        format = "html",
        output = tmpFile,
        label = "Session State",
        expand = false,
        top = 3
    )
    var dumpHtml = fileRead( tmpFile )
    fileDelete( tmpFile )
    res.type( "text/html; charset=utf-8" ).send( dumpHtml )
} )
```

### It's fine for dev, not for hot paths

Both the temp-file round trip and the HTML dump renderer itself have real cost compared to `res.json()`. That's a non-issue for an occasional debug route hit by a developer, but it's not something to leave wired into a frequently-hit production endpoint.
