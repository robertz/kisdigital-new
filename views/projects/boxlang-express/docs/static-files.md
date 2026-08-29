# Static Files & Uploads

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

A request for a file that doesn't exist under the served directory falls through to `next()` rather than erroring — your other routes (or the default 404) still get a chance to handle it.

## Directory requests without a trailing slash

A request that resolves to a directory but is missing its trailing slash (e.g. `/public/docs` when `./public/docs/index.html` exists) gets a `301` redirect to the slash-suffixed URL instead of a 404 — the same behavior as `express.static()`. The slash-suffixed URL is the canonical one: relative asset links inside the served HTML resolve correctly against it and wouldn't against the bare path.

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

Both static file serving and `res.sendFile()`/`download()` honor a `Range` request header and respond `206 Partial Content` with just the requested slice — what makes video/audio scrubbing and resumable downloads work, since the client doesn't have to (re-)download the whole file to seek or resume. Every file response sets `Accept-Ranges: bytes`, even a full `200`, so a client knows it can send a `Range` request on a later one:

```bash
curl -H "Range: bytes=0-1023" localhost:3000/public/video.mp4
# -> 206, Content-Range: bytes 0-1023/<total>, body is just those 1024 bytes
```

A range starting beyond the file's size gets a `416 Range Not Satisfiable` with `Content-Range: bytes */<total>` and no body. Two things are out of scope, the trade-off most minimal static-file servers make: a request naming more than one range falls back to a full `200` response instead of a `multipart/byteranges` reply, and `If-Range` (a conditional range against a validator) isn't supported — a `Range` request is always attempted regardless of freshness.

## Sending a single file from a route

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
> This documentation section is read-only — there's no working upload form wired up here to try. The code above is exactly what the API supports; wire it into your own app to see it in action.
