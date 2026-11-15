# Testing

Sign users in from your own specs with the test provider, and run the module's own tests.

## Testing your app

`boxExpressAuthTestProvider()` logs in through the real `/auth` routes — state, PKCE, your `verify()`, session regeneration — as whatever identity a spec names, with no provider account and no network:

```bxs
testLogin = boxExpressAuthTestProvider( { identity: { id: "u1", email: "ada@example.com" } } )
auth.provider( "test", testLogin )      // only when building the app for tests

var login = testLogin.login( app )                              // → { response, location, cookies, started }
expect( app.inject( { url: "/dashboard", cookies: login.cookies } ).statusCode ).toBe( 200 )

testLogin.login( app, { identity: { id: "u2", emailVerified: false }, returnTo: "/settings" } )
testLogin.login( app, { deny: "access_denied" } )               // the user clicked Cancel
testLogin.login( app, { fail: "profile_failed" } )              // or "token_exchange_failed"
testLogin.link( app, { cookies: login.cookies, form: { _csrf: token } } )
```

Its default identity is `{ id: "test-user", email: "test@example.com", emailVerified: true, name: "Test User", username: "test" }`, merged with the `identity` you pass. Its `callbackUrl` defaults to `http://localhost/auth/<name>/callback`; set it if you mount the routes elsewhere. For a step at a time, `approve( location, identity )` and `deny( location, error )` turn the `Location` of `GET /auth/test` into the callback path to inject.

It can't log anyone in from a browser — `GET /auth/test` redirects to `auth.test.invalid`, which never resolves, and a code only exists once test code calls `approve()` — but register it only when building the app for tests all the same.

## The module's own tests

```bash
box install                # testbox + boxlang-express into boxlang_modules/
boxlang setup-tests.bxs    # once per checkout
boxlang run-tests.bxs
```

Specs drive the app with `app.inject()`; provider APIs are a `FakeHttpClient` that fails the test on any unscripted URL, and ID tokens are signed by real RSA and EC keys generated per run. The only sockets any spec opens are on loopback: `HttpClientSpec`'s in-process server, and `WebSocketGuardSpec`'s app (port 38742) for real upgrade requests.
