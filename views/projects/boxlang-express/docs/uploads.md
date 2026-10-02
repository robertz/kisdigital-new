# File Uploads

Opt-in `multipart/form-data` parsing with `boxExpressUpload()`, mirroring [multer](https://github.com/expressjs/multer)'s basic usage.

## Enabling uploads

```bxs
app.use( boxExpressUpload() )                                       // in-memory only
app.use( boxExpressUpload( { dest: expandPath( "./uploads" ) } ) )  // also saved to disk
```

Or via the underlying class:

```bxs
multipart = new bxModules.boxexpress.models.middleware.Multipart()
app.use( multipart.upload( { dest: expandPath( "./uploads" ) } ) )
```

## Handling an upload

```bxs
app.post(
    "/upload",
    boxExpressUpload( { dest: expandPath( "./uploads" ) } ),
    ( req, res ) => {
        res.json( { fields: req.body, files: req.files } )
    }
)
```

`boxExpressUpload()` parses a `multipart/form-data` request: non-file fields land in `req.body` same as any other body parser. `req.files` is a struct keyed by field name, each value an _array_ of file structs — a field can carry more than one file — with shape `{ fieldName, filename, contentType, size, buffer, path }`. `path` is only present when `dest` was given; the client-supplied filename is never used to build it, sidestepping path-traversal/collision entirely. The file's extension is kept only if it's 1–10 letters or digits (lower-cased); anything else is dropped.

> [!WARNING] Keep uploads out of your static directory
> Don't point `dest` inside a directory `boxExpressStatic()` serves. An uploaded `.html` or `.svg` would then be served back as a page on your own origin.

```bxs
app.get( "/uploaded-avatar", ( req, res ) => {
    res.json( {
        filename: req.files.avatar[ 1 ].filename,
        size: req.files.avatar[ 1 ].size,
        savedAt: req.files.avatar[ 1 ].path
    } )
} )
```

## Size limit

Like the other body parsers, the whole body is capped — at 10MB by default. Override with `{ limit: bytes }`; an oversized upload gets a `413` before your handler runs.

> [!WARNING] No live demo on this site
> This documentation section is read-only — there's no working upload form wired up here to try. The code above is exactly what the API supports; wire it into your own app to see it in action.
