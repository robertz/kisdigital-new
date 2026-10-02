# CSRF Protection

`boxExpressCsrf()` — session-based CSRF tokens, exposed as `req.csrfToken()`.

## Usage

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

```bxs
app.post( "/form", ( req, res ) => {
    // A missing/mismatched token never reaches this handler — it gets a
    // 403 from the middleware first.
    res.send( "ok" )
} )
```

## How it validates

"Safe" methods (`GET`/`HEAD`/`OPTIONS` by default, override with `options.ignoreMethods`) never validate — a token is only minted and exposed via `req.csrfToken()` for those, since that's how a token gets into a form before any state-changing request happens. Every other method must submit a matching token: read from `req.body[fieldName]` first (`options.fieldName`, default `"_csrf"`), falling back to a request header (`options.headerName`, default `"X-CSRF-Token"`) for non-form (JSON/AJAX) clients. A missing/mismatched token gets a `403` before the route handler ever runs. The comparison is constant-time and case-sensitive. Registering this before `req.session` exists throws immediately rather than silently doing nothing — a misconfiguration here should be loud, not a security hole that only shows up in production.
