# Request & Response

The full req.* and res.* API available inside every handler.

## The request object

| Property / Method | Description |
|---|---|
| `req.method` | Uppercased HTTP method, e.g. `"GET"` |
| `req.path` | Path portion of the URL, no query string |
| `req.originalUrl` | Path plus query string as received |
| `req.query` | Struct of parsed query-string parameters |
| `req.params` | Struct of captured route params (`:id` segments) |
| `req.body` | Parsed request body — populated by `boxExpressJSON()`/`boxExpressUrlencoded()`/`boxExpressUpload()`, empty struct otherwise |
| `req.files` | Uploaded files, populated by `boxExpressUpload()` |
| `req.headers` | Struct of request headers |
| `req.get(name)` | Read a single header by name — returns null if absent |
| `req.cookies` | Struct of parsed cookies |
| `req.ip` | Direct TCP peer address by default; prefers an edge-set header named via `"trust proxy header"`, else `X-Forwarded-For` when `app.set("trust proxy", true)` — see [Configuration](/projects/boxlang-express/docs/config) |
| `req.protocol` / `req.secure` | Always `"http"` / `false` — BoxExpress's own `HttpServer` never terminates TLS — unless `trust proxy` is on and the request carries `X-Forwarded-Proto: https` |
| `req.hostname` | The `Host` header (or `X-Forwarded-Host` with `trust proxy` on) with any `:port` stripped |
| `req.session` / `req.sessionID` | Populated by `boxExpressSession()` — see [Sessions](/projects/boxlang-express/docs/sessions) |
| `req.rawExchange()` | Escape hatch to the underlying `io.undertow.server.HttpServerExchange` |

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
| `res.render(view, data)` | Renders a view — see [Views & Templates](/projects/boxlang-express/docs/views) |
| `res.sse(callback)` | Opens a long-lived Server-Sent Events stream — see [Server-Sent Events](/projects/boxlang-express/docs/server-sent-events) |
| `res.dump(data)` | Sends BoxLang's rich, collapsible `dump()` HTML view of a variable as the response — useful for quick debugging routes |
| `res.getStatusCode()` | Returns the eventual status code — reflects the real outcome even when a route never called `status()` directly, since every non-`200` terminal method routes through it internally. For request-logging middleware registered first via `app.use()`, which otherwise can't observe a request's outcome |
| `res.getBytesWritten()` | Returns the body byte count sent so far; `0` for a response still in flight |
| `res.onBeforeSend(callback)` | Registers a callback that runs once, synchronously, the instant before headers are flushed — the last point guaranteed to run after every downstream handler but still early enough to add a header |

## Examples

```bxs
app.get( "/headers-demo", ( req, res ) => {
    res.header( "X-Powered-By", "BoxLang Express" )
       .type( "text/plain" )
       .send( "check the headers" )
} )

app.get( "/whoami", ( req, res ) => {
    res.json( { ip: req.ip, userAgent: req.get( "User-Agent" ) } )
} )

app.get( "/moved", ( req, res ) => {
    res.redirect( "/new-location", 301 )
} )

app.get( "/debug", ( req, res ) => {
    res.dump( req.query )
} )
```

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

A dump can expose more than you'd want a stranger to see — internal struct shapes, full session contents, request headers. Guard debug-only routes the same way the framework's own error pages decide whether to reveal a real error message (see [Error Handling](/projects/boxlang-express/docs/errors)):

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
