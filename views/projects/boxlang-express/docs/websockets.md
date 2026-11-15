# WebSockets

A WebSocket route via `app.ws(path, callback, options)` — a separate route table from `app.get`/`app.post`/etc. and from `Router`. The `app.use()` chain doesn't run for an upgrade; a route can run middleware of its own against the upgrade request instead (see [Middleware for the upgrade request](#middleware-for-the-upgrade-request)).

## Registering a route

```bxs
app.ws( "/chat", ( connection ) => {
    connection.onMessage( ( text ) => connection.send( "echo:" & text ) )
    connection.onClose( ( code, reason ) => println( "disconnected: " & code ) )
} )
```

`callback` receives a `WebSocketConnection` the moment a client connects. Register `onMessage()`/`onClose()` on it synchronously, before returning from the callback — messages can start arriving as soon as the handshake completes, so registering afterward can race a fast client.

Path matching is exact only — no `:params`, no mount paths. An upgrade request to a path with no registered `app.ws()` route falls through to the normal HTTP chain unchanged — it gets whatever that path would otherwise return (a `404` if nothing matches) rather than being silently accepted as a WebSocket connection; an app that registers no `app.ws()` routes at all pays nothing for the upgrade check.

## WebSocketConnection

- `onMessage(callback)` — `callback(text)`, one call per text frame received.
- `onBinary(callback)` — `callback(bytes)` (a Java `byte[]`) for each binary message. Binary messages are dropped if none is registered.
- `onClose(callback)` — `callback(code, reason)`, fires exactly once whether the client disconnected, the connection dropped, or `close()` was called locally (a locally-initiated close did not fire it before 0.2.15). A write that fails or times out also closes the connection and fires it, so your cleanup runs instead of leaving a zombie.
- `send(data)` — writes one text frame. Complex data is JSON-serialized unless it's already a simple value, matching `res.sse()`'s emitter convention. No-ops once the connection is closed rather than throwing, so broadcasting to many connections doesn't blow up the whole loop on one stale one. The underlying write is bounded by a hard 5s timeout, so a peer that vanishes mid-write can't hang the caller.
- `sendBinary(bytes)` — writes one binary frame (a `byte[]`, as `fileReadBinary()` returns); `send()` does the same when it's handed bytes rather than a string or struct (0.2.27+).
- `close()` / `isClosed()`.
- `headers` / `cookies` — the handshake request's headers and cookies (mirroring `req.headers`/`req.cookies`), and `get(name)` to read a single header. `app.ws()` routes sit outside the `app.use()` chain, so no session, CORS or CSRF middleware runs for an upgrade unless the route lists it in `options.use`.
- `req` — the upgrade request, on a route with `options.use` (also passed to the handler as its second argument).

There's no `onOpen`/`onError` callback — the connection is handed to the `app.ws()` callback at open time instead, which serves the same purpose, and errors surface as a connection close rather than a separate event.

## Middleware for the upgrade request

A WebSocket starts life as an HTTP request, and that request is the one moment you can check who's connecting. `options.use` runs ordinary `( req, res, next )` middleware against it before the handshake:

```bxs
sessions = boxExpressSession()
app.use( sessions )

requireUser = ( req, res, next ) => {
	if ( isNull( req.session.userId ) ) {
		return res.status( 401 ).send( "Log in first" )
	}
	next()
}

app.ws( "/chat", ( connection, req ) => {
	connection.onMessage( ( text ) => {
		rooms.broadcast( req.query.room, req.session.userId, text )
	} )
}, { use: [ sessions, requireUser ] } )
```

- **If every middleware calls `next()`, the socket opens**, and the handler gets the upgrade's `req` as its second argument (also `connection.req`) — with whatever the middleware put on it: `req.session`, `req.user`, `req.query`, `req.cookies`.
- **A middleware that sends a response refuses the upgrade.** The client's WebSocket fails to open and sees that status (`401` above).
- A middleware that throws, calls `next( err )` with nothing handling it, or returns without doing either, refuses the upgrade with a bare `500` and logs why. Error-handling middleware (`( err, req, res, next )`) in the `use` list can answer instead.
- `use` takes one function or an array. They run in order, on a virtual thread, so they may block (a session store, a database lookup).

Things that trip people up:

- **Pass the same session middleware instance** you gave `app.use()`, as above. Each `boxExpressSession()` call with the default in-memory store has its own store, so a second instance would never find the session the first one created. (With a shared `store`, separate instances are fine.)
- **`app.use()` middleware still doesn't run** for upgrades — only what's in `use`. That's deliberate: an app's catch-all 404 handler, registered with `app.use()`, would otherwise answer every upgrade before it reached the handshake.
- **`req.session` is a snapshot from connect time.** It's saved when the upgrade completes; a change made to it later, from a message handler, isn't written back. Read identity from it, and keep per-connection state in your own variables.
- The origin check (below) still runs first, before any middleware.
- A route without `use` behaves exactly as before: the handler gets only `connection`, and there's no `connection.req`.

## Origin check

A browser sends cookies with the WebSocket handshake whichever site the page is on, so without a check any website could open an authenticated socket as its visitor (cross-site WebSocket hijacking). `app.ws()` routes accept only same-origin pages by default: the page's `Origin` must match the `Host` it connected to (or `X-Forwarded-Host` from a trusted proxy), and anything else gets a `403` before the upgrade. Clients that send no `Origin` — servers, CLI tools, the cluster relay — aren't browsers and are let through.

Change it per route, or for every route:

```bxs
app.ws( "/chat", handler, { origins: [ "https://app.example.com" ] } )
app.set( "wsOrigins", "*" )   // the old allow-everything behavior
```

> [!NOTE] Behavior change in 0.2.20
> `app.ws()` used to accept any origin. A page served from a different origin than the socket now needs to be listed in `origins` or `wsOrigins`.

## Message size limit

Incoming messages are capped at 1 MB by default. A larger one is refused and the connection closed with a `1009` (message too big), so an unauthenticated client can't make the server buffer an unbounded message — Undertow's own default is unlimited (CVE-2026-81624, no upstream fix yet). This applies to every `app.ws()` route, including [STOMP](/projects/boxlang-express/docs/stomp) and the cluster relay. Change the limit with `app.set( "wsMaxMessageSize", bytes )` before `listen()`:

```bxs
app.set( "wsMaxMessageSize", 65536 )   // 64 KB
```

## Idle timeout

`app.set( "wsIdleTimeoutMs", ms )` (default `0`, off) drops a connection that has sent nothing — no message, no ping, no pong — for that long, and fires its `onClose`. The server pings every third of that period, and a healthy client (every browser, automatically) answers, so a quiet but alive connection is never dropped; one whose peer vanished, or that ignores pings, is. It's opt-in because the right value depends on your clients; `60000` is a reasonable start. Together with the message size limit above, this bounds what an unauthenticated client can make the server hold (CVE-2026-81624).

## Broadcasting to multiple clients

`connection` is a plain object, the same way `res.sse()`'s `emitter` is — nothing ties it to being used only inside the callback it was handed to. Stash it somewhere shared and another route can call `.send()` on it directly:

```bxs
connections = {}   // shared across requests — id -> connection

app.ws( "/chat", ( connection ) => {
    var id = createUUID()
    connections[ id ] = connection
    connection.onClose( ( code, reason ) => structDelete( connections, id ) )
} )

app.post( "/announce", ( req, res ) => {
    for ( var id in connections ) {
        connections[ id ].send( req.body.message )
    }
    res.json( { sentTo: structCount( connections ) } )
} )
```

`send()` is safe to call this way from more than one thread at once — each connection funnels through its own per-connection lock, so two writers can't interleave on the shared channel, the same reasoning and fix shape as `res.sse()`'s emitter thread-safety (see [Server-Sent Events](/projects/boxlang-express/docs/sse)).

> [!NOTE] Every callback runs on its own thread
> The `app.ws()` connect callback and `onMessage`/`onClose` are all dispatched onto their own virtual thread, never called directly from the I/O thread — a blocking handler (including a synchronous `send()` in the connect callback) doesn't stall other connections. A handler that mutates shared state (a rooms/subscribers struct, like the broadcast pattern above) still needs its own locking around that mutation; nothing here serializes two connections' callbacks against each other.

## STOMP pub/sub

For destination-based messaging (`SUBSCRIBE`/`SEND`) rather than tracking connections by hand — the shape most chat, notification and live-update use cases actually want — `boxExpressStomp()` layers a full STOMP 1.0/1.1/1.2 broker on top of `app.ws()`. See [STOMP](/projects/boxlang-express/docs/stomp).

## Scheduled background jobs

If what you actually need is periodic work rather than push messaging — a cleanup job, polling an external API — see [`app.schedule()`](/projects/boxlang-express/docs/scheduler) instead; it doesn't touch WebSockets/STOMP at all.

## What this isn't

There's no rooms/presence abstraction beyond STOMP destinations, no auth/middleware chain integration for a raw `app.ws()` route (auth only exists at the STOMP layer), and no `:params` or `Router` mounting for WebSocket paths — the simplest version that covers a real route table, extended if a real need for pattern-matched paths shows up.

A small worked example — multiple channels, join/leave presence, message history, all on raw `app.ws()` with no STOMP — is live at [/games/chat](/games/chat/).
