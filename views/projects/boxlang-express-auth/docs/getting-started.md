# Getting Started

Install the module, sign people in with GitHub, and guard your routes.

## Requirements

- BoxLang 1.15+ and [boxlang-express](/projects/boxlang-express) 0.2.26+ (0.2.27+ to guard WebSocket upgrades).
- Not included: refresh tokens, token storage, an account-linking UI (the route is here, the settings page is yours), password login, API tokens, ID-token algorithms other than RS256/384/512 and ES256/384/512.

## Install

```bash
install-bx-module boxlang-express-auth
```

or with CommandBox: `box install boxlang-express-auth`.

Install `boxlang-express` too, if the app doesn't already have it — this module builds its routes with `boxExpressRouter()` but doesn't install BoxExpress for you. Both land in the app's `boxlang_modules/`.

## Quickstart

```bxs
app = boxExpress()
app.set( "trust proxy", 1 )

auth = boxExpressAuth( {
	// Required. Map the provider identity to your own user.
	// Return a struct with at least { id }, or null to refuse the login.
	verify: ( identity, tokens, req ) => users.findOrCreateFromIdentity( identity ),
	// Optional. Turns the stored id back into req.user on guarded routes.
	// Without it, req.user is { id }.
	loadUser: ( id ) => users.get( id ),
	successRedirect: "/",          // after login (unless returnTo) and after browser logout
	failureRedirect: "/login",     // gets ?error=<code>
	loginPath: "/login"            // where required() sends anonymous browsers
} )

auth.provider( "github", boxExpressAuthGitHub( {
	clientId: getSystemSetting( "GITHUB_CLIENT_ID" ),
	clientSecret: getSystemSetting( "GITHUB_CLIENT_SECRET" ),
	callbackUrl: "https://tracker.example.com/auth/github/callback",
	scopes: [ "read:user", "user:email" ]     // the default
} ) )

app.use( boxExpressSession( { resave: false, saveUninitialized: false } ) )   // required, and first
app.use( boxExpressUrlencoded() )
app.use( boxExpressCsrf() )                       // optional; guards POST /auth/logout too
app.use( "/auth", auth.routes() )

app.get( "/dashboard", auth.required(), ( req, res ) => res.json( { user: req.user } ) )
app.get( "/", auth.optional(), ( req, res ) => res.render( "home", { user: req.user ?: "" } ) )
```

Link to `/auth/github` to sign in, or `/auth/github?returnTo=/projects/7` to come back somewhere specific. `examples/server.bxs` is a complete runnable demo (`GITHUB_CLIENT_ID=… GITHUB_CLIENT_SECRET=… boxlang examples/server.bxs`).

## Routes

Mounted wherever you `app.use()` the router — the callback URLs you register with providers have to point at the same place.

| Route | |
|---|---|
| `GET /auth/:provider` | Starts a login. `?returnTo=` takes a relative path only. |
| `GET /auth/:provider/callback` | Where the provider sends the user back. |
| `POST /auth/:provider/callback` | Only for providers that come back with a form post (Apple). Answers `303` to the GET callback; see [Apple](/projects/boxlang-express-auth/docs/apple). Otherwise `404`. |
| `POST /auth/:provider/link` | A signed-in user attaching another provider account. Only with a `link` option; see [Linking accounts](/projects/boxlang-express-auth/docs/users#linking-accounts). |
| `POST /auth/logout` | Destroys the session. Redirects to `successRedirect` when `Accept` includes `text/html`, otherwise `204`. If the user signed in through an OIDC provider with `postLogoutRedirectUrl`, it sends them on to the issuer's logout instead ([on the OIDC page](/projects/boxlang-express-auth/docs/oidc#logging-out-at-the-issuer)). There is no `GET` logout — a link or an `<img>` on another site must not be able to sign people out. Use a form. |

An unknown provider name is a `404`.

## Guards

- `auth.required()` — passes logged-in requests with `req.user` set. An anonymous request whose `Accept` includes `text/html` is redirected to `loginPath?returnTo=<the original URL>`; anything else gets `401 { error: true, code: "unauthenticated" }`. Point `loginPath` at `/auth/github` to skip a login page when GitHub is your only provider.
- `auth.optional()` — sets `req.user` if logged in, never blocks. Fine to mount globally; `loadUser` still runs once per request.

If `loadUser` returns null (the account was deleted), the request is treated as anonymous and the stale id is cleared from the session.

Both work as WebSocket upgrade middleware (BoxExpress 0.2.27+). Pass the same session middleware instance you gave `app.use()`, then the guard:

```bxs
sessions = boxExpressSession()
app.use( sessions )

app.ws( "/live", ( connection, req ) => {
	connection.onMessage( ( text ) => feed.publish( req.user.id, text ) )
}, { use: [ sessions, auth.required() ] } )
```

A signed-in user's socket opens with `req.user` set. Anyone else gets a plain `401` — never the login redirect, whatever the upgrade's `Accept` says, since a socket can't follow one.

## What happens on the callback

1. The pending login is removed from the session — whatever happens next, that `state` can't be used again.
2. `state` is compared, in constant time, with the one minted at the start; it must also be under 10 minutes old (`stateTtlSeconds`).
3. The code is exchanged (with the PKCE verifier), then the profile fetched.
4. `verify( identity, tokens, req )` runs. Null, or no `id`, refuses the login.
5. The session is **regenerated** (new id, old one deleted — no session fixation), then `req.session.auth.userId` is set.
6. Redirect to `returnTo`, or `successRedirect`.

Provider tokens are handed to `verify()` and then dropped: they're never written to the session or logged. If your app needs one later (say, to call the GitHub API for repositories), store it yourself — encrypted — in `verify()`. `tokens` is `{ accessToken, tokenType, scope }`.

If `verify()` or `loadUser()` **throws**, that goes to your error handler as a 500 — it means your code or your database failed, not the login.
