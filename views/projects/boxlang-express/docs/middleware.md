# Middleware

app.use(), execution order, and the middleware that ships with the framework.

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

Middleware and routes share one stack, run in the order they were registered. A middleware registered after all your routes acts as a catch-all — that's exactly how a themed 404 page is built, see [Error Handling](/projects/boxlang-express/docs/errors).

## Built-in middleware

| BIF | Purpose |
|---|---|
| `boxExpressJSON()` | Parses `application/json` request bodies into `req.body` |
| `boxExpressUrlencoded()` | Parses `application/x-www-form-urlencoded` bodies into `req.body` |
| `boxExpressStatic(dir)` | Serves static files from `dir`, with ETag/Last-Modified conditional GET support |
| `boxExpressSession()` | Cookie-based sessions — populates `req.session` |
| `boxExpressUpload(options)` | Parses `multipart/form-data` — fields into `req.body`, files into `req.files` |
| `boxExpressHelmet(options)` | Sets security-hardening response headers (clickjacking, MIME-sniffing, referrer leakage, etc.) — see below |
| `boxExpressCors(options)` | Cross-Origin Resource Sharing — sets `Access-Control-*` headers and answers preflight requests — see below |
| `boxExpressRateLimit(options)` | Fixed-window rate limiting, keyed by `req.ip` by default — see below |
| `boxExpressCsrf(options)` | CSRF protection via `req.session` — exposes `req.csrfToken()` — see below |
| `boxExpressRouter()` | Returns a mountable `Router` — see [Routing](/projects/boxlang-express/docs/routing) |

```bxs
app.use( boxExpressJSON() )
app.use( boxExpressUrlencoded() )
app.use( boxExpressSession() )
app.use( "/public", boxExpressStatic( expandPath( "./public" ) ) )
```

These are opt-in by design — a route that never reads `req.body` doesn't pay for body-parsing on every request.

## Security headers (boxExpressHelmet)

Mirrors the npm [helmet](https://github.com/helmetjs/helmet) package's most commonly used defaults, with no configuration needed:

```bxs
app.use( boxExpressHelmet() )
```

| Header | Default |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-DNS-Prefetch-Control` | `off` |
| `Referrer-Policy` | `no-referrer` |
| `X-Permitted-Cross-Domain-Policies` | `none` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` |
| `Strict-Transport-Security` | _off by default — opt in_ |
| `Content-Security-Policy` | _off by default — opt in_ |

Every option takes three shapes: omitted (the default above), `false` (skip that header entirely), or an exact string to use instead:

```bxs
app.use( boxExpressHelmet( {
    frameOptions: "DENY",              // override the default value
    referrerPolicy: false,             // skip this header entirely
    hsts: true,                        // opt in, using the built-in default
    contentSecurityPolicy: "default-src 'self'"   // opt in, with your own policy
} ) )
```

`hsts` and `contentSecurityPolicy` are opt-in rather than on by default: `Strict-Transport-Security` only makes sense over an actually-secure connection — BoxLang Express's own `HttpServer` never terminates TLS itself, see [Request & Response](/projects/boxlang-express/docs/request-response) for `req.secure` — so turning it on unconditionally could advertise a guarantee the app doesn't meet. A generic default `Content-Security-Policy` is exactly the kind of thing that breaks a real app's own inline scripts/styles or asset domains if applied blindly, so it needs the app's own policy string rather than a one-size-fits-all default.

## CORS (boxExpressCors)

Cross-Origin Resource Sharing, mirroring the npm [cors](https://github.com/expressjs/cors) package's most commonly used options. With no options, reflects whatever `Origin` the request sent (or `*` if there wasn't one) — permissive by default, same as the npm package:

```bxs
app.use( boxExpressCors() )
app.use( boxExpressCors( { origin: "https://example.com" } ) )
app.use( boxExpressCors( { origin: [ "https://a.com", "https://b.com" ], credentials: true } ) )
```

| Option | Default | Effect |
|---|---|---|
| `origin` | `true` | `true` reflects the request's `Origin`; `false` disables CORS entirely; a string allows only that exact origin; an array allows any origin in the list |
| `methods` | `GET,HEAD,PUT,PATCH,POST,DELETE` | `Access-Control-Allow-Methods` on a preflight response |
| `allowedHeaders` | _reflects the preflight's own request_ | `Access-Control-Allow-Headers` on a preflight response |
| `credentials` | `false` | sets `Access-Control-Allow-Credentials: true` when `true` |
| `maxAge` | _none_ | `Access-Control-Max-Age` (seconds) on a preflight response |

A CORS preflight — an `OPTIONS` request carrying `Access-Control-Request-Method` — is answered directly by this middleware (`204`, the relevant headers, no body) rather than falling through to the router, since nothing would otherwise be registered to handle `OPTIONS` on an arbitrary route.

## Rate limiting (boxExpressRateLimit)

Fixed-window rate limiting, mirroring the npm [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit) package's most commonly used options:

```bxs
app.use( boxExpressRateLimit() )                                     // 100 req/min per req.ip
app.use( "/login", boxExpressRateLimit( { windowMs: 15 * 60000, max: 5 } ) )  // 5 req/15min, scoped to one route
```

Sets the draft-standard `RateLimit-Limit`/`RateLimit-Remaining`/`RateLimit-Reset` headers, and responds `429` with `Retry-After` once a key's count exceeds `max` within `windowMs`. Fixed window, not a sliding one or a token bucket — a client can get up to 2x `max` requests through right at a window boundary, the same trade-off most minimal in-memory rate limiters make in exchange for O(1) bookkeeping per request.

Each call creates its own counters, so different routes can have independent limits:

```bxs
app.post(
    "/upload",
    boxExpressRateLimit( { windowMs: 5 * 60000, max: 10 } ),
    boxExpressUpload( { dest: expandPath( "./uploads" ) } ),
    ( req, res ) => { /* ... */ }
)
```

## CSRF protection (boxExpressCsrf)

Mirrors the classic [csurf](https://github.com/expressjs/csurf) package's session-based token strategy. The token lives in `req.session`, not its own cookie, so this must be registered _after_ `boxExpressSession()`:

```bxs
app.use( boxExpressSession() )
app.use( boxExpressUrlencoded() )   // before Csrf if reading the token from a form field
app.use( boxExpressCsrf() )

app.get( "/form", ( req, res ) => {
    res.render( "form", { csrfToken: req.csrfToken() } )
} )
```

```html
<form method="POST" action="/form">
  <input type="hidden" name="_csrf" value="#data.csrfToken#">
  ...
</form>
```

"Safe" methods (`GET`/`HEAD`/`OPTIONS` by default) never validate — a token is only minted and exposed via `req.csrfToken()` for those, since that's how a token gets into a form before any state-changing request happens. Every other method must submit a matching token: `req.body._csrf` first, falling back to an `X-CSRF-Token` header for non-form (JSON/AJAX) clients. A missing/mismatched token gets a `403` before the route handler ever runs. Registering this before `req.session` exists throws immediately rather than silently doing nothing.

## Writing your own middleware: a Google OAuth example

Everything above is a BIF that ships with the framework, but a middleware "layer" is just a `(req, res, next)` function — nothing stops you from writing your own. As a worked example, here's a small Google OAuth 2.0 login flow built entirely out of the pieces already on this page: `req.session` from `boxExpressSession()`, `res.redirect()`, and the same `state`-parameter CSRF check `boxExpressCsrf()` uses for forms, applied here to the OAuth redirect instead.

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

Register error-handling middleware last, after every route — mirroring the built-in default it's overriding. See [Error Handling](/projects/boxlang-express/docs/errors) for the full picture, including the framework's own default 404/500 behavior.
