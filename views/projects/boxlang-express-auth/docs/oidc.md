# Any OpenID Connect Provider

Keycloak, Authelia and any other OIDC issuer, from its discovery document, including logout at the issuer.

## Configuration

```bxs
auth.provider( "keycloak", boxExpressAuthOIDC( {
	name: "keycloak",
	issuer: "https://sso.example.com/realms/tracker",
	clientId: getSystemSetting( "OIDC_CLIENT_ID" ),
	clientSecret: getSystemSetting( "OIDC_CLIENT_SECRET" ),
	callbackUrl: "https://tracker.example.com/auth/keycloak/callback"
} ) )
```

The provider reads `<issuer>/.well-known/openid-configuration` on the first login (not at startup, so the app boots while the IdP is down), sends a `nonce` with every login, and validates the ID token before `verify()` sees anything:

- the signature, against the issuer's JWKS — RS256/384/512 with an RSA key of at least 2048 bits, or ES256/384/512 with a P-256/P-384/P-521 key; `none` and HMAC are refused. The key set is cached and refetched once when a token names an unknown `kid` (a key rotation), at most every `jwksMinRefreshSeconds` (default 60).
- `iss` is the configured issuer, and the discovery document names that same issuer.
- `aud` contains `clientId`; `azp`, when present (or when there are several audiences), is `clientId`.
- `exp` hasn't passed and `iat` isn't in the future, give or take `clockSkewSeconds` (default 60).
- `nonce` is the one minted for this login.

The identity's `id` is `sub`; `username` is `preferred_username`; `emailVerified` is `email_verified` (the string `"true"` counts). When the ID token has no email, the userinfo endpoint is read as well — its `sub` must match, and it never overrides a signed ID-token claim.

| Option | Default | |
|---|---|---|
| `issuer` | — | Required. https, or http on `localhost`/`127.0.0.1`/`[::1]` only |
| `name` | `"oidc"` | Register under the same name you use here |
| `scopes` | `[ "openid", "email", "profile" ]` | Must include `openid` |
| `userinfo` | `"auto"` | `"auto"` (when the ID token lacks an email), `"always"`, `"never"` |
| `clockSkewSeconds` | `60` | |
| `jwksMinRefreshSeconds` | `60` | |
| `acceptedIssuers` | `[ issuer ]` | Extra `iss` spellings (Google uses this) |
| `algorithms` | RS256/384/512, ES256/384/512 | Narrow it, never widen it |
| `postLogoutRedirectUrl` | none | Turns on [logout at the issuer](/projects/boxlang-express-auth/docs/oidc#logging-out-at-the-issuer) |
| `logoutIdTokenHint` | `false` | Keep the ID token in the session to send as `id_token_hint` |
| `authorizeUrl`, `tokenUrl`, `jwksUri`, `userinfoUrl`, `endSessionUrl` | discovered | Give the first three to skip discovery |

`tokens` passed to `verify()` includes `idToken` for OIDC providers. It isn't stored, unless `logoutIdTokenHint` asks for it.

Keycloak: create a confidential client (*Client authentication* on, *Standard flow* on), set the redirect URI, and use `https://<host>/realms/<realm>` as the issuer. Authelia: register the client under `identity_providers.oidc.clients` with `authorization_policy`, `redirect_uris`, `scopes: [ openid, email, profile ]` and `require_pkce: true`, `pkce_challenge_method: S256`; the issuer is Authelia's own URL. Authelia often leaves email out of the ID token, which is what `userinfo: "auto"` covers.

## Logging out at the issuer

`POST /auth/logout` ends the session in your app; the user is still signed in at Keycloak, Authelia or Microsoft, and the next login goes straight through. For single sign-on that's rarely what "Sign out" should mean. Give the provider a `postLogoutRedirectUrl` (registered with the issuer as a post-logout redirect URI) and logout continues at the issuer's `end_session_endpoint`:

```bxs
auth.provider( "keycloak", boxExpressAuthOIDC( {
	…,
	postLogoutRedirectUrl: "https://tracker.example.com/"
} ) )
```

- A form post (`Accept: text/html`) gets a `303` to `<end_session_endpoint>?client_id=…&post_logout_redirect_uri=…`.
- A `fetch()` gets `200 { logoutUrl }` — set `location.href` to it.
- The local session is destroyed first either way. If the issuer has no `end_session_endpoint` (GitLab, Google), or discovery fails, it's a normal local logout.

Without an `id_token_hint`, most issuers show a "do you want to sign out?" page. `logoutIdTokenHint: true` keeps the login's ID token in the session (`req.session.auth.logout.idToken`) so it can be sent, and the issuer skips the question. It's off by default because it's the one token this module would otherwise never store: an ID token isn't an API credential, but it is a signed statement of who the user is, sitting in your session store.
