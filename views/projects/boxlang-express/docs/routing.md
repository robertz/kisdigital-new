# Routing

HTTP method handlers, route params, wildcards, param() callbacks, and mountable sub-routers.

## Basic routes

Every HTTP verb has a matching method on `app`, each taking a path and one or more `(req, res)` handlers:

```bxs
app.get( "/", ( req, res ) => res.send( "Hello" ) )
app.post( "/items", ( req, res ) => res.json( { created: true } ) )
app.put( "/items/:id", ( req, res ) => res.json( { updated: req.params.id } ) )
app.patch( "/items/:id", ( req, res ) => res.json( { patched: req.params.id } ) )
app.delete( "/items/:id", ( req, res ) => res.json( { deleted: req.params.id } ) )
app.all( "/ping", ( req, res ) => res.send( "matched: " & req.method ) )
```

`app.all()` matches every HTTP method for a path — useful for logging or auth checks scoped to one route without duplicating the handler per verb.

## Matching rules

- Path matching is case-insensitive for literal segments, which matches Express's own default.
- A route registered with no handler function throws immediately, rather than silently registering nothing.
- Register all routes and middleware before calling `listen()` — see [App](/projects/boxlang-express/docs/app#register-everything-before-listen).

## HEAD is automatic

Every `app.get()` route also answers `HEAD` for free — same handler, same headers (including `Content-Length`), just with the body thrown away before it reaches the client, same as Express. This applies to static file serving too:

```bash
curl -I localhost:3000/
# -> 200, Content-Length reflects the real body, no response body sent
```

Register `app.head(path, ...)` explicitly, _before_ the matching `app.get()`, only when `HEAD` needs to behave differently than "run the `GET` handler and discard the body" — e.g. to skip work the body needed but the headers alone don't.

## Route parameters

A path segment prefixed with `:` captures into `req.params`:

```bxs
app.get( "/users/:id", ( req, res ) => {
    res.json( { id: req.params.id } )
} )
// GET /users/42 → { "id": "42" }
```

A trailing `:name?` marks the last param as optional:

```bxs
app.get( "/users/:id?", ( req, res ) => {
    res.json( { id: req.params.id ?: "(all users)" } )
} )
// GET /users/42 → { "id": "42" }
// GET /users     → { "id": "(all users)" }
```

Same restriction as the `*` wildcard below: an optional param is only supported as the _final_ path segment — `/a/:id?/b` throws at registration time, since matching one anywhere else would need real backtracking this router doesn't implement.

## Wildcards

A trailing `*` segment matches any remaining path:

```bxs
app.get( "/files/*", ( req, res ) => {
    res.send( "matched a file under /files/" )
} )
// GET /files/a/b/c.txt → matches
```

A `*` anywhere other than the end of the pattern throws at registration time, rather than silently matching more or less than you'd expect.

## param() callbacks

`app.param(name, callback)` registers a callback that runs once before any route handler using that param name, letting you resolve/validate it in one place instead of every handler:

```bxs
app.param( "id", ( req, res, next, value ) => {
    req.params.id = "loaded-" & value  // e.g. look up a record here
    next()
} )

app.get( "/users/:id", ( req, res ) => {
    res.json( { id: req.params.id } )  // "loaded-42"
} )
```

Calling `next(err)` from inside a param() callback aborts straight to error-handling middleware, same as from a regular handler. It works the same on a standalone `Router` — `router.param(...)`.

## Chaining with route()

`app.route(path)` returns a chainable object for registering multiple methods on one path without repeating it:

```bxs
app.route( "/widgets" )
    .get( ( req, res ) => res.json( { list: [] } ) )
    .post( ( req, res ) => res.status( 201 ).json( { created: true } ) )
```

It works the same on a standalone `Router` — `router.route(path)`.

## Mountable routers

A `Router` is a standalone, mountable route table with the same routing methods as `app` — group related routes and mount them under a path prefix. Create one with `boxExpressRouter()` (or `new bxModules.boxexpress.models.Router()` directly):

```bxs
apiRouter = boxExpressRouter()

apiRouter.get( "/ping", ( req, res ) => {
    res.json( { pong: true } )
} )

app.use( "/api", apiRouter )
// GET /api/ping → { "pong": true }
```

Inside a mounted router, `req.path` has the mount prefix stripped for the duration of that router's middleware/handlers, then restored afterward — so a router doesn't need to know what prefix it was mounted under.

## 404 for unmatched routes

If nothing in the stack matches, the framework's default handler sends a 404. See [Error Handling](/projects/boxlang-express/docs/error-handling) for how to replace it with a themed page.
