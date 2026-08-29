# Error Handling

The framework's default 404/500 behavior, and how a themed HTML error page overrides it.

## Default behavior

Out of the box, with no custom error handling registered, the framework responds to both cases with JSON:

| Case | Default response |
|---|---|
| No route matches | `404` — `{ "error": true, "message": "Cannot GET /whatever" }` |
| A route/middleware throws, uncaught | `500` — `{ "error": true, "message": "Internal Server Error" }` |

The 500 body hides the real error message unless `app.set("env", "development")` was used — an unhandled exception's message (file paths, driver errors, internal identifiers) would otherwise leak straight to an unauthenticated client. The full message is always logged server-side regardless of this setting.

## Overriding both, with your own HTML

Because 404/500 handling is just middleware under the hood, replacing it doesn't need any framework change — register your own after every route. **This is exactly how this site's own error pages are built** — try visiting [a page that doesn't exist](/projects/boxlang-express/this-page-does-not-exist) to see it live. The relevant shape, straight from a real `app.bxs`:

```bxs
// app.bxs

// Themed 404 — must come after every real route, since it's an unconditional
// catch-all: whatever hasn't matched by the time dispatch reaches this falls
// through to it.
app.use( ( req, res ) => {
    res.status( 404 ).render( "main/404", {
        pageTitle : "Page Not Found"
    } )
} )

// Themed 500 — a 4-arg handler only runs when a route/middleware throws or
// calls next(err), same as the framework's own default error handler.
app.use( ( err, req, res, next ) => {
    println( "[error] " & err.message )
    res.status( 500 ).render( "main/error", {
        pageTitle : "Server Error"
    } )
} )
```

Both render a themed template (light/dark aware, matching the rest of the site) rather than the framework's plain JSON default — keeping the whole thing self-contained in the app, no changes to the framework itself. See [Views & Templates](/projects/boxlang-express/docs/views) for how `res.render()` and view partials work.

> [!NOTE] Why this only needs app-level middleware
> Since a 404 catch-all and a 4-arg error handler are both just ordinary middleware, they compose with everything else in the stack — logging middleware still runs first, sessions are still available in the error page if you want them, and nothing about the framework's own routing or dispatch logic needs to change.

## Explicitly forwarding an error

Call `next(err)` from inside a normal handler or middleware to skip straight to error-handling middleware, same as a thrown exception:

```bxs
app.get( "/risky", ( req, res, next ) => {
    if ( !req.query.token ) {
        next( { message: "missing token" } )
        return
    }
    res.send( "ok" )
} )
```
