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
| `res.set(name, value)` / `res.header(name, value)` | Sets an arbitrary response header — aliases of each other; `res.set( { ... } )` sets several |
| `res.get(name)` / `res.append(name, value)` / `res.vary(field)` | Reads a header set so far / adds to one / adds to `Vary` — see [Header helpers](#header-helpers) |
| `res.location(url)` / `res.links(map)` / `res.attachment(filename)` | `Location`, `Link` and `Content-Disposition` without ending the response — see [Header helpers](#header-helpers) |
| `res.type(mimeType)` | Sets `Content-Type`; an extension works too (`res.type( "json" )`) |
| `res.cookie(name, value, options)` | Sets a `Set-Cookie` header — see [Cookies](#cookies) |
| `res.clearCookie(name, options)` | Tells the browser to drop a cookie — see [Cookies](#cookies) |
| `res.redirect(url, code = 302)` | Sends a redirect with a caller-supplied status code |
| `res.end(data = "")` | Ends the response with an optional body, no content-type inference |
| `res.sendBytes(bytes, contentType)` | Sends raw bytes with an explicit content type, bypassing the string/UTF-8 round trip |
| `res.sendFile(path, options)` | Sends a file inline, with ETag/Last-Modified 304 support; `options.root` sandboxes the path against directory-escape |
| `res.download(path, filename)` | `sendFile()` that forces `Content-Disposition: attachment` |
| `res.render(view, data)` | Renders a view, inside the app's layout if one is set — see [Views](/projects/boxlang-express/docs/views) |
| `res.format(handlers)` | Runs the handler for the type the request's `Accept` prefers — see [`res.format()`](#resformat) |
| `res.sse(callback)` | Opens a long-lived Server-Sent Events stream — see [Server-Sent Events](/projects/boxlang-express/docs/sse) |
| `res.dump(data)` | Sends BoxLang's rich, collapsible `dump()` HTML view of a variable as the response — useful for quick debugging routes |
| `res.getStatusCode()` | Returns the eventual status code — reflects the real outcome even when a route never called `status()` directly, since every non-`200` terminal method routes through it internally. For request-logging middleware registered first via `app.use()`, which otherwise can't observe a request's outcome |
| `res.getBytesWritten()` | Returns the body byte count sent so far; `0` for a response still in flight |
| `res.onBeforeSend(callback)` | Registers a callback that runs once, synchronously, the instant before headers are flushed — the last point guaranteed to run after every downstream handler but still early enough to add a header |

## Header helpers

```bxs
res.set( { "X-Frame-Options": "DENY", "X-Robots-Tag": "noindex" } )  // several at once
res.get( "Content-Type" )                 // what's been set so far, or null
res.append( "Warning", "199 Miscellaneous warning" )   // adds; set() replaces
res.type( "json" )                        // an extension works: "json", ".png", "csv"
res.vary( "Accept-Language" )
res.location( "/users/42" )               // just the header — no status, response stays open
res.links( { next: "/users?page=3", last: "/users?page=9" } )
res.attachment( "report.csv" )
```

- **`res.append()`** writes `Set-Cookie` as one header line per value. Any other header is joined into a single comma-separated line — the same thing to a client, and it keeps `res.get()` returning the whole value.
- **`res.type()`** with no `/` in it is looked up as a file extension; an unknown one becomes `application/octet-stream`.
- **`res.vary()`** adds to `Vary` rather than replacing it and skips a field that's already listed, so middleware can each add their own. Set it whenever a response depends on a request header (`Accept`, `Accept-Language`, `Origin`, `Cookie`) and may be cached — otherwise a shared cache can hand one visitor a response built for another. `boxExpressCors()` and `res.format()` call it for you. `"*"` replaces the list and stays.
- **`res.links()`** builds a `Link` header (`</users?page=3>; rel="next"`), the usual way to page an API, and adds to one already set.
- **`res.attachment()`** sets `Content-Disposition: attachment` for a body you build yourself, where [`res.download()`](#sending-files) is for a file on disk. A filename also sets `Content-Type` from its extension.

A value with a line break in it is refused (the handler gets a `BoxExpress.InvalidHeaderValue`), same as `res.set()`.

## `res.format()`

Runs the handler for whichever type the request's `Accept` header prefers — one route serving a browser and an API client:

```bxs
app.get( "/users/:id", ( req, res ) => {
	var user = users.get( req.params.id )
	res.format( [
		html: () => res.render( "user", user ),
		json: () => res.json( user ),
		"text/csv": () => res.attachment( "user.csv" ).send( toCsv( user ) )
	] )
} )
```

Keys are extensions or full MIME types. `Content-Type` is set to the chosen one before its handler runs, and `Accept` is added to `Vary`. If nothing matches, a `default` handler runs if you gave one; otherwise the response is `406 Not Acceptable`.

**Use an ordered struct (`[ ... ]`), as above.** When a client has no preference (`Accept: */*`, or no header — `curl`, most API clients) the first key wins, and a plain `{ ... }` struct doesn't keep its keys in the order you wrote them. Selection follows the same rules as [`req.accepts()`](/projects/boxlang-express/docs/request#content-negotiation).

## Cookies

`res.cookie( name, value, options )` options: `path` (default `"/"`), `domain`, `maxAge` (seconds), `expires` (a date), `httpOnly` (default `true`), `secure`, `sameSite`, `signed`.

`res.clearCookie( name, options )` tells the browser to drop a cookie, by sending it back empty and already expired:

```bxs
res.cookie( "prefs", "dark", { path: "/account", domain: "example.com" } )
// later
res.clearCookie( "prefs", { path: "/account", domain: "example.com" } )
```

A browser only removes the cookie whose `path` and `domain` match, so pass the same ones it was set with — a cookie set with `path: "/account"` is untouched by a bare `res.clearCookie( "prefs" )`. Pass `secure` and `sameSite` along too if it was set with `sameSite: "None"`, which browsers reject without `Secure`. To end a session, use `req.destroySession()` instead (see [Sessions](/projects/boxlang-express/docs/sessions)), which also removes the server-side data.

### Signed cookies

A cookie is whatever the browser sends back, and a user can edit theirs. Signing one lets you tell: the value travels with an HMAC of itself, and a value that doesn't match its signature is rejected when it comes back.

```bxs
app.set( "cookie secret", server.system.environment.COOKIE_SECRET )

app.post( "/prefs", ( req, res ) => {
	res.cookie( "plan", "pro", { signed: true, maxAge: 86400 } )
	res.sendStatus( 204 )
} )

app.get( "/dashboard", ( req, res ) => {
	var plan = req.signedCookies.plan ?: "free"
	if ( plan === false ) {
		plan = "free"            // present, but tampered with
	}
	...
} )
```

- **`req.signedCookies`** holds each signed cookie's original value. A cookie whose signature doesn't check out is there as `false`, so you can tell "tampered" from "absent". Test for it with `=== false`: a plain `==` would also match a genuine value of `"false"`, `"no"` or `"0"`. Signed cookies are removed from `req.cookies` either way — a forged one can't be picked up by code reading the plain struct.
- **`res.cookie( ..., { signed: true } )`** throws `BoxExpress.NoCookieSecret` if no secret is set.
- **Signed is not encrypted.** The value is readable by anyone holding the cookie; the signature only proves the server issued it. Don't put anything secret in one. A signed cookie is also valid for as long as the browser keeps it — signing doesn't add an expiry or tie the value to one user — so for anything that must be revocable, keep it in the [session](/projects/boxlang-express/docs/sessions) instead.
- **Keep the secret out of source control** and make it long and random (32+ bytes). An empty secret throws at `app.set()`.
- **Rotating the secret:** pass an array. The first entry signs new cookies and every entry is accepted when reading, so existing cookies keep working until you drop the old one:

  ```bxs
  app.set( "cookie secret", [ newSecret, oldSecret ] )
  ```

The format is the one Express's `cookie-parser` uses (`s:<value>.<base64 HMAC-SHA256>`), so an Express app and a BoxExpress app sharing a secret can read each other's signed cookies. Values are signed as strings; there's no equivalent of cookie-parser's `j:` JSON cookies — serialize a struct yourself if you need one. The session cookie isn't signed and doesn't need to be: it's a random 256-bit id with nothing to forge.

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
