# Sessions

Cookie-based sessions via req.session.

## Enabling sessions

```bxs
app.use( boxExpressSession() )
```

Once registered, every request gets a session — a new one is created and a session cookie set if the request didn't already carry one.

## Reading and writing session data

```bxs
app.get( "/visit-count", ( req, res ) => {
    req.session.views = ( req.session.views ?: 0 ) + 1
    res.json( { views: req.session.views, sessionID: req.sessionID } )
} )
```

`req.session` is a plain struct — read and write it directly. It's persisted server-side and keyed by `req.sessionID`, which is also readable directly for logging or debugging.

## Ending a session

```bxs
app.get( "/logout", ( req, res ) => {
    req.destroySession()
    res.json( { loggedOut: true } )
} )
```

`req.destroySession()` clears the stored session data and expires the session cookie on the client (`Max-Age=0`) — the next request starts a fresh session.

## Skipping unnecessary store writes (resave, saveUninitialized)

By default, every request through this middleware writes to the store — even one that never reads or touches `req.session` at all. Free against the default in-memory store, a real cost against anything out-of-process (a JDBCStore-backed `boxExpressCacheStore()`, Redis, etc). Two options, mirroring Express's own `express-session` options of the same names, turn that off:

```bxs
app.use( boxExpressSession( {
    store: myStore,
    resave: false,             // don't re-save an existing session that wasn't modified
    saveUninitialized: false   // don't save (or cookie) a new session that wasn't modified
} ) )
```

- `saveUninitialized: false` — a freshly created session that's never modified isn't saved, and isn't given a `Set-Cookie` either. This is the one that matters most in practice: an anonymous request that only ever reads `req.session` — including a vulnerability scanner throwing a burst of unrelated 404s at a public site — shouldn't mint and persist a throwaway session for each one.
- `resave: false` — an existing session that was loaded but never modified isn't re-written to the store. The cookie is still refreshed either way; only the store write is skipped.
- A session that _is_ modified, new or existing, is always saved regardless of either option.

Both default to `true` (the historical always-save behavior), so upgrading doesn't change anything unless you opt in. Recommended `false` for anything backed by a real datastore.

## Durable sessions (boxExpressCacheStore)

The default session store is an in-memory `ConcurrentHashMap` on the `Session` instance — fine for one process, gone on restart, and not shared across a cluster. `boxExpressCacheStore()` is a ready-made `store` backed by BoxLang's own `cache()` service instead:

```bxs
app.use( boxExpressSession( { store: boxExpressCacheStore( "sessions" ) } ) )
```

The named cache (`"sessions"` here) has to already be registered in `boxlang.json` — this doesn't create one, it just talks to it. Point that cache's `objectStore` at `"JDBCStore"` and session data lands in a real SQL table instead of memory, surviving a restart and shared across every process pointed at the same database:

```json
"caches": {
  "default": { "provider": "BoxCacheProvider" },
  "sessions": {
    "provider": "BoxCacheProvider",
    "properties": {
      "objectStore": "JDBCStore",
      "datasource": "sessionDB",
      "table": "boxlang_sessions",
      "autoCreate": false
    }
  }
}
```

See [Configuration](/projects/boxlang-express/docs/config) for the full datasource block. Two _separate_ things worth knowing, found by actually running it against a real database rather than trusting the docs:

- Keep `"default"` in the `caches` block alongside your own entry — overriding `caches` replaces it wholesale, and BoxLang's own query engine depends on a `"default"` cache existing somewhere in it.

## The session cookie

The session cookie is named `connect.sid`, matching Express's own default — familiar if you're coming from Node. It's set with `HttpOnly` by default, the same as `res.cookie()`.
