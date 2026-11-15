# Reference

Options, failure codes, the errors you'll see while wiring it up, and cookies behind a proxy.

## Options

| Option | Default | |
|---|---|---|
| `verify` | — | Required. `( identity, tokens, req ) => user struct or null` |
| `loadUser` | none | `( id ) => user struct or null` |
| `successRedirect` | `"/"` | |
| `failureRedirect` | `"/login"` | `?error=` (or `&error=`) is appended |
| `loginPath` | `"/login"` | |
| `sessionKey` | `"auth"` | Key under `req.session` this module owns |
| `stateTtlSeconds` | `600` | |
| `link` | none | `( identity, user, tokens, req ) => true/false`. Turns on `POST /auth/:provider/link` |
| `linkRedirect` | `successRedirect` | After a link (unless `returnTo`) |
| `linkFailureRedirect` | `failureRedirect` | After a failed link, with `?error=` |

Every provider takes `clientId`, `clientSecret`, `callbackUrl` (all required), `scopes`, `authorizeParams` (extra authorize-URL parameters such as `{ prompt: "select_account" }`; the flow's own — `state`, `nonce`, `scope`, `redirect_uri`, PKCE — can't be overridden), `userAgent` (default `boxlang-express-auth`) and `httpClient`. The OIDC providers (generic, Google, Microsoft, GitLab) add the options on their own pages.

## Failure codes

`failureRedirect` gets `?error=` with one of these, and nothing else — a provider's own error text is never echoed:

| Code | Meaning |
|---|---|
| `access_denied` | The user declined on the provider's consent screen. |
| `provider_error` | The provider sent back any other error or no code — or, on `GET /auth/:provider`, an OIDC issuer's discovery document couldn't be read. |
| `invalid_state` | State missing, wrong, already used, or no login was pending in this session. |
| `expired_state` | Took longer than 10 minutes. |
| `token_exchange_failed` | The provider refused the code (GitHub: HTTP 200 with an `error` body). |
| `profile_failed` | The profile couldn't be read, or an OIDC ID token failed validation (the log says which check). |
| `login_denied` | `verify()` returned null. |
| `link_denied` | A link was refused: `link()` returned false or null, or the user who started it is no longer the one signed in. Sent to `linkFailureRedirect`. |

The reason is logged server-side (`[BoxExpressAuth] github login failed: …`), never with codes, tokens or the client secret.

## Errors you'll see while wiring it up

| Type | When |
|---|---|
| `BoxExpressAuth.SessionRequired` | A request reached the auth routes or a guard without `boxExpressSession()` in front. |
| `BoxExpressAuth.InvalidConfig` | No `verify` function, or `loadUser` or `link` isn't one. |
| `BoxExpressAuth.InvalidProvider` | Missing `clientId`/`clientSecret`/`callbackUrl`, a relative `callbackUrl`, a bad provider name, an `authorizeParams` key the flow owns, or (OIDC) a missing or plain-http issuer or no `openid` scope. |
| `BoxExpressAuth.DuplicateProvider` | Two providers registered under one name. |

## Behind a proxy, and cookies

The callback is a top-level `GET` from github.com back to your site, so the session cookie must be sent on a cross-site navigation: the default `sameSite: "Lax"` works; **`sameSite: "Strict"` makes every login fail with `invalid_state`**. Set `secure: true` on the session cookie once TLS is in front, and `app.set( "trust proxy", … )` as [BoxExpress's docs](/projects/boxlang-express/docs/config#app-level-settings) describe.

With a database-backed session store, keep `boxExpressSession()`'s `resave: false, saveUninitialized: false`.

Consider rate-limiting the auth routes: `app.use( "/auth", boxExpressRateLimit( { max: 30, windowMs: 60000 } ) )` before mounting them.
