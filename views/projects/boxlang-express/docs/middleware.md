# Middleware

app.use(), execution order, body parsers, and static file serving.

## Registering middleware

`app.use(handler)` runs a `(req, res, next)` function on every request, in registration order, before route handlers:

```bxs
app.use( ( req, res, next ) => {
    println( "#req.method# #req.path#" )
    next()
} )
```

A handler that doesn't call `next()` ends the chain there — nothing after it runs unless the handler itself sends a response. Scope middleware to a path prefix by passing it as the first argument:

```bxs
app.use( "/api", ( req, res, next ) => {
    // only runs for requests under /api
    next()
} )
```

`app.use()` also takes more than one handler in a single call — `app.use(mw1, mw2, mw3)` registers three separate layers at once, running in the order given:

```bxs
app.use(
    ( req, res, next ) => { println( "#req.method# #req.path#" ); next() },
    ( req, res, next ) => { res.set( "X-Powered-By", "BoxLang Express" ); next() }
)
```

The first argument is only ever treated as a mount path when it's a plain string — anything else (a closure, or a mounted `Router`) is a target — so `app.use(handler)` and `app.use(path, handler)` are told apart the same way no matter how many more handlers follow.

> [!NOTE] Common pattern
> Grouping related middleware — JSON parsing, urlencoded parsing, sessions, static files — into one `app.use()` call keeps a project's `app.bxs` readable instead of scattering four separate registrations across the file.

## Order matters

Middleware and routes share one stack, run in the order they were registered. A middleware registered after all your routes acts as a catch-all — that's exactly how a themed 404 page is built, see [Error Handling](/projects/boxlang-express/docs/error-handling).

## Built-in middleware

Each is opt-in, with its own global function mirroring the Express one of the same name:

| BIF | Purpose |
|---|---|
| `boxExpressJSON()` | Parses `application/json` request bodies into `req.body` |
| `boxExpressUrlencoded()` | Parses `application/x-www-form-urlencoded` bodies into `req.body` |
| `boxExpressStatic(dir)` | Serves static files from `dir` — see [Serving static files](#serving-static-files) below |
| `boxExpressUpload(options)` | Parses `multipart/form-data` — see [File Uploads](/projects/boxlang-express/docs/uploads) |
| `boxExpressSession()` | Cookie-based sessions, `req.session` — see [Sessions](/projects/boxlang-express/docs/sessions) |
| `boxExpressHelmet(options)` | Security-hardening response headers — see [Security Headers](/projects/boxlang-express/docs/helmet) |
| `boxExpressCors(options)` | Cross-Origin Resource Sharing — see [CORS](/projects/boxlang-express/docs/cors) |
| `boxExpressRateLimit(options)` | Fixed-window rate limiting — see [Rate Limiting](/projects/boxlang-express/docs/rate-limiting) |
| `boxExpressCsrf(options)` | CSRF protection via `req.session` — see [CSRF Protection](/projects/boxlang-express/docs/csrf) |
| `boxExpressStomp(options)` | A STOMP pub/sub broker on top of `app.ws()` — see [STOMP](/projects/boxlang-express/docs/stomp) |
| `boxExpressRouter()` | Returns a mountable `Router` — see [Routing](/projects/boxlang-express/docs/routing) |

```bxs
app.use( boxExpressJSON() )
app.use( boxExpressUrlencoded() )
app.use( boxExpressSession() )
app.use( "/public", boxExpressStatic( expandPath( "./public" ) ) )
```

These are opt-in by design — a route that never reads `req.body` doesn't pay for body-parsing on every request.

The same thing spelled out via the underlying classes, if you'd rather not lean on the BIFs:

```bxs
bodyParsers = new bxModules.boxexpress.models.middleware.BodyParsers()
app.use( bodyParsers.json() )
app.use( bodyParsers.urlencoded() )

staticFiles = new bxModules.boxexpress.models.middleware.StaticFiles()
app.use( "/public", staticFiles.serve( expandPath( "./public" ) ) )
```

## Body size limits

`boxExpressJSON()` and `boxExpressUrlencoded()` cap the request body at 100KB by default, to keep a slow or malicious client from buffering an unbounded body into memory. Override with `{ limit: bytes }`:

```bxs
app.use( boxExpressJSON( { limit: 5000000 } ) )  // 5MB
```

A body over the limit gets a `413` response and never reaches your route handler.

## Serving static files

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

Requested files are resolved against the real (symlink-resolved) served directory, so a symlink placed inside it can't be used to read files from outside it.

### Dotfiles

A path with any segment starting with `.` (`/.env`, `/.git/config`) is ignored by default — it falls through to the next handler as if the file weren't there, so a stray secret in the public directory isn't served. `/.well-known/` is always served.

| `dotfiles` | Effect |
|---|---|
| `"ignore"` (default) | Fall through to `next()` |
| `"deny"` | Answer `403` |
| `"allow"` | Serve them |

```bxs
app.use( boxExpressStatic( expandPath( "./public" ), { dotfiles: "deny" } ) )
```

> [!NOTE] Behavior change in 0.2.20
> Dotfiles used to be served. If you relied on that, pass `{ dotfiles: "allow" }`.

### Streaming

Files are streamed from disk rather than read into memory, so a large file costs the same memory as a small one, `HEAD` never reads the file, and files over 2 GB (including `Range` requests into them) work. The same applies to `res.sendFile()` and `res.download()`. Common modern types — `.mjs`, `.webp`, `.wasm`, `.map` — get their proper `Content-Type`.

### Directory requests without a trailing slash

A request that resolves to a directory but is missing its trailing slash (e.g. `/public/docs` when `./public/docs/index.html` exists) gets a `301` redirect to the slash-suffixed URL instead of a 404 — the same behavior as `express.static()`. The slash-suffixed URL is the canonical one: relative asset links inside the served HTML resolve correctly against it and wouldn't against the bare path.

```bxs
app.use( "/public", boxExpressStatic( expandPath( "./public" ) ) )
// GET /public/docs   → 301 to /public/docs/
// GET /public/docs/  → serves ./public/docs/index.html
```

### Conditional GET (ETag / 304)

Static file responses automatically set `ETag` and `Last-Modified`, and honor `If-None-Match` — a matching request gets a `304 Not Modified` with no body, instead of re-sending the file. `If-None-Match` handles a list of tags, `*`, and weak tags, and compares case-sensitively. The same conditional-GET support applies to `res.sendFile()`.

### Cache-Control (options.maxAge)

`boxExpressStatic()` and `res.sendFile()` both accept `options.maxAge` (seconds) to also set `Cache-Control: public, max-age=<n>`, letting a browser skip revalidation entirely for that long instead of asking on every request. Off by default — no header at all unless asked for:

```bxs
app.use( "/public", boxExpressStatic( expandPath( "./public" ), { maxAge: 86400 } ) )  // 1 day

app.get( "/report", ( req, res ) => {
    res.sendFile( expandPath( "./reports/latest.pdf" ), { maxAge: 3600 } )  // 1 hour
} )
```

### HEAD and Range requests

`HEAD /public/logo.png` returns the same headers a `GET` would — `Content-Type`, `Content-Length`, `ETag`, `Last-Modified` — with no response body. See [Routing](/projects/boxlang-express/docs/routing) for how `HEAD` works across the framework generally.

Static files also honor a `Range` request header and respond `206 Partial Content` with just the requested slice — the details are the same as for `res.sendFile()`, under [Response](/projects/boxlang-express/docs/response#range-requests-partial-content).

## Writing your own middleware: a Google OAuth example

Everything above ships with the framework, but a middleware "layer" is just a `(req, res, next)` function — nothing stops you from writing your own. As a worked example, here's a small Google OAuth 2.0 login flow built entirely out of the pieces already on this page: `req.session` from `boxExpressSession()`, `res.redirect()`, and the same `state`-parameter check [CSRF protection](/projects/boxlang-express/docs/csrf) uses for forms, applied here to the OAuth redirect instead.

Rather than one factory returning one handler, this one returns a _struct_ of three related handlers — a pattern worth using any time a feature needs more than one route to work together:

```bxs
// googleAuth.bx
function googleAuth( options ) {
    var clientId     = options.clientId
    var clientSecret = options.clientSecret
    var redirectUri  = options.redirectUri
    var scope        = options.scope ?: "openid email profile"

    return {
        // GET /auth/google — kick off the flow
        login: ( req, res ) => {
            var state = createUUID()
            req.session.oauthState = state   // validated in callback, below
            var authUrl = "https://accounts.google.com/o/oauth2/v2/auth"
                & "?client_id=" & urlEncodedFormat( clientId )
                & "&redirect_uri=" & urlEncodedFormat( redirectUri )
                & "&response_type=code"
                & "&scope=" & urlEncodedFormat( scope )
                & "&state=" & urlEncodedFormat( state )
            res.redirect( authUrl )
        },

        // GET /auth/google/callback — Google redirects back here
        callback: ( req, res ) => {
            if ( ( req.query.state ?: "" ) != ( req.session.oauthState ?: "" ) ) {
                return res.status( 403 ).send( "Invalid OAuth state - possible CSRF attempt" )
            }
            var code = req.query.code ?: ""
            if ( !len( code ) ) {
                return res.status( 400 ).send( "Missing code" )
            }

            var httpClient = createObject( "java", "java.net.http.HttpClient" ).newHttpClient()

            var tokenRequest = createObject( "java", "java.net.http.HttpRequest" )
                .newBuilder()
                .uri( createObject( "java", "java.net.URI" ).create( "https://oauth2.googleapis.com/token" ) )
                .header( "Content-Type", "application/x-www-form-urlencoded" )
                .POST( createObject( "java", "java.net.http.HttpRequest$BodyPublishers" ).ofString(
                    "code=" & urlEncodedFormat( code )
                    & "&client_id=" & urlEncodedFormat( clientId )
                    & "&client_secret=" & urlEncodedFormat( clientSecret )
                    & "&redirect_uri=" & urlEncodedFormat( redirectUri )
                    & "&grant_type=authorization_code"
                ) )
                .build()
            var tokenData = JSONDeserialize(
                httpClient.send( tokenRequest, createObject( "java", "java.net.http.HttpResponse$BodyHandlers" ).ofString() ).body()
            )

            var userRequest = createObject( "java", "java.net.http.HttpRequest" )
                .newBuilder()
                .uri( createObject( "java", "java.net.URI" ).create( "https://www.googleapis.com/oauth2/v3/userinfo" ) )
                .header( "Authorization", "Bearer " & tokenData.access_token )
                .GET()
                .build()
            var profile = JSONDeserialize(
                httpClient.send( userRequest, createObject( "java", "java.net.http.HttpResponse$BodyHandlers" ).ofString() ).body()
            )

            req.session.user = { email: profile.email, name: profile.name, picture: profile.picture }
            structDelete( req.session, "oauthState" )
            res.redirect( "/" )
        },

        // route guard — drop this in front of anything that needs a logged-in user
        requireAuth: ( req, res, next ) => {
            if ( isNull( req.session.user ) ) {
                return res.redirect( "/auth/google" )
            }
            next()
        }
    }
}
```

Wiring it up in `app.bxs` — three lines, since the factory above already did the work:

```bxs
// app.bxs
var auth = googleAuth( {
    clientId: getSystemSetting( "GOOGLE_CLIENT_ID" ),
    clientSecret: getSystemSetting( "GOOGLE_CLIENT_SECRET" ),
    redirectUri: "https://yourapp.com/auth/google/callback"
} )

app.get( "/auth/google", auth.login )
app.get( "/auth/google/callback", auth.callback )
app.get( "/dashboard", auth.requireAuth, ( req, res ) => {
    res.render( "dashboard", { user: req.session.user } )
} )
```

`getSystemSetting( name, defaultValue )` is BoxLang's native BIF for exactly this — it reads both real environment variables and JVM system properties (whichever's set), and picks up whatever a `.env` file supplied at startup the same as a real shell-exported variable would. Throws if the variable isn't set and no `defaultValue` is given — pass one (e.g. `getSystemSetting( "GOOGLE_CLIENT_ID", "" )`) to get an empty string back instead. `createObject("java","java.lang.System").getenv("VAR_NAME")` also works, but `getSystemSetting()` is the native, idiomatic way to reach for this in application code.

## Error-handling middleware

A handler with **four** parameters — `(err, req, res, next)` — is treated as error-handling middleware. It's skipped during normal dispatch and only invoked when a route/middleware throws, or explicitly calls `next(err)`:

```bxs
app.get( "/boom", ( req, res ) => {
    throw( message = "kaboom", type = "DemoError" )
} )

app.use( ( err, req, res, next ) => {
    res.status( 500 ).json( { error: true, message: err.message } )
} )
```

Register error-handling middleware last, after every route — mirroring the built-in default it's overriding. See [Error Handling](/projects/boxlang-express/docs/error-handling) for the full picture, including the framework's own default 404/500 behavior.
