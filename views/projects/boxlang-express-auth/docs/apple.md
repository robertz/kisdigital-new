# Sign in with Apple

Apple's signed client secret, its form-POST callback, and the name it sends only once.

## Apple

```bxs
auth.provider( "apple", boxExpressAuthApple( {
	clientId: getSystemSetting( "APPLE_SERVICES_ID" ),        // the Services ID, e.g. com.example.tracker.web
	teamId: getSystemSetting( "APPLE_TEAM_ID" ),
	keyId: getSystemSetting( "APPLE_KEY_ID" ),
	privateKey: fileRead( getSystemSetting( "APPLE_PRIVATE_KEY_PATH" ) ),   // the .p8 file
	callbackUrl: "https://tracker.example.com/auth/apple/callback"
} ) )

app.use( boxExpressUrlencoded() )
app.use( boxExpressSession( { resave: false, saveUninitialized: false } ) )
app.use( "/auth", auth.formPostRoutes() )      // before CSRF — see below
app.use( boxExpressCsrf() )
app.use( "/auth", auth.routes() )
```

There's no `clientSecret`: Apple's is a JWT signed (ES256) with your key, and the provider mints a fresh one, valid for five minutes, for each code exchange. The key never leaves the process, and errors never quote it.

**The callback is a POST.** When you ask for `name` or `email` (the default `scopes`), Apple sends the user back with a form post from appleid.apple.com. Two things follow:

- A `SameSite=Lax` session cookie isn't sent on a cross-site POST, so the login couldn't be matched to its session there. `POST /auth/apple/callback` doesn't try: it answers `303` to `GET /auth/apple/callback?code=…&state=…`, a top-level navigation the cookie *is* sent with, and the usual checks run there. Keep `sameSite: "Lax"`; don't loosen it to `None` for Apple's sake.
- `boxExpressCsrf()` would refuse that POST (no token, no session). Mount `auth.formPostRoutes()` — only that one route — at the same path *before* the CSRF middleware, as above, and `boxExpressUrlencoded()` before both. Without the body parser the POST arrives empty and the login fails with `provider_error` (the log says why).

With `scopes: []` Apple uses a plain GET callback and none of that applies — but then there's no email in the ID token.

**The name comes once.** Apple never puts the name in the ID token; it posts it as a `user` field on the user's *first* authorization of your app only. The provider holds it in memory, keyed by a hash of that login's state, until the GET callback hands it to `verify()` as `identity.name`. Save it then — later logins have `name: ""`. With several app instances and no sticky sessions the GET can land elsewhere and the name is lost (the login still works); the user can get Apple to send it again by removing your app under *Sign in with Apple* in their Apple account settings. The email in that `user` field is ignored; `identity.email` comes from the signed ID token.

`identity.id` is Apple's `sub`, stable for your developer team. `identity.email` may be a private relay address (`…@privaterelay.appleid.com`) — `identity.isPrivateEmail` says so — and `emailVerified` is Apple's `email_verified`. Apple has no userinfo endpoint and no `end_session_endpoint`, so logout is local only.

To register: in the Apple developer account create an App ID with *Sign in with Apple*, then a *Services ID* (its identifier is `clientId`) with your domain and the return URL `<origin>/auth/apple/callback` — Apple requires https and a real domain, so local development needs a tunnel. Under *Keys*, create a key with *Sign in with Apple*; download the `.p8` once (`privateKey`) and note its Key ID (`keyId`) and your Team ID (`teamId`).
