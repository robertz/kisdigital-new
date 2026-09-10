# WebSockets

A WebSocket route via `app.ws(path, callback)` — a separate route table from `app.get`/`app.post`/etc. and from `Router`, since a WebSocket connection has no `req`/`res`/`next()` chain to run through.

## Registering a route

```bxs
app.ws( "/chat", ( connection ) => {
    connection.onMessage( ( text ) => connection.send( "echo:" & text ) )
    connection.onClose( ( code, reason ) => println( "disconnected: " & code ) )
} )
```

`callback` receives a `WebSocketConnection` the moment a client connects. Register `onMessage()`/`onClose()` on it synchronously, before returning from the callback — messages can start arriving as soon as the handshake completes, so registering afterward can race a fast client.

Path matching is exact only — no `:params`, no mount paths. An upgrade request to a path with no registered `app.ws()` route falls through to the normal HTTP chain unchanged; an app that registers no `app.ws()` routes at all pays nothing for the upgrade check.

## WebSocketConnection

- `onMessage(callback)` — `callback(text)`, one call per text frame received.
- `onClose(callback)` — `callback(code, reason)`, fires whether the client disconnected or `close()` was called locally.
- `send(data)` — writes one text frame. Complex data is JSON-serialized unless it's already a simple value, matching `res.sse()`'s emitter convention. No-ops once the connection is closed rather than throwing, so broadcasting to many connections doesn't blow up the whole loop on one stale one.
- `close()` / `isClosed()`.

There's no `onOpen`/`onError` callback — the connection is handed to the `app.ws()` callback at open time instead, which serves the same purpose, and errors surface as a connection close rather than a separate event.

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

`send()` is safe to call this way from more than one thread at once — each connection funnels through its own per-connection lock, so two writers can't interleave on the shared channel, the same reasoning and fix shape as `res.sse()`'s emitter thread-safety (see [Server-Sent Events](/projects/boxlang-express/docs/server-sent-events)).

> [!NOTE] Every callback runs on its own thread
> `onMessage`/`onClose` are dispatched onto their own virtual thread, never called directly from the I/O thread — a blocking handler doesn't stall other connections. A handler that mutates shared state (a rooms/subscribers struct, like the broadcast pattern above) still needs its own locking around that mutation; nothing here serializes two connections' callbacks against each other.

## STOMP pub/sub

`middleware/Stomp` layers a full [STOMP](https://stomp.github.io/) 1.2 pub/sub broker (destination-based `SUBSCRIBE`/`SEND`) on top of `app.ws()` — the shape most chat/notification/live-update use cases actually want, rather than tracking connections and destinations by hand:

```bxs
stomp = boxExpressStomp()
app.ws( "/stomp", stomp.handler() )

app.post( "/orders", ( req, res ) => {
    stomp.send( "/topic/orders", { orderId: newOrder.id } )   // server-side publish
} )
```

Or via the underlying class directly, for the full options struct below:

```bxs
stomp = new bxModules.boxexpress.models.middleware.Stomp( {
    authenticate: ( login, passcode, host, connection, connectionMetadata ) => {
        connectionMetadata.role = login == "admin" ? "admin" : "guest"   // read back in authorize() below
        return login == "demo" && passcode == "demo"
    },
    authorize: ( login, destination, access, connection, connectionMetadata ) => {
        return destination != "/topic/admin-only" || connectionMetadata.role == "admin"
    },
    heartbeatMs: 10000
} )
app.ws( "/stomp", stomp.handler() )
```

`authenticate(login, passcode, host, connection, connectionMetadata)` gates `CONNECT` — return `false` and the client gets an `ERROR` frame and the connection closes. `authorize(login, destination, access, connection, connectionMetadata)` gates each `SUBSCRIBE`/`SEND` (`access` is `"subscribe"` or `"publish"`) — return `false` and that one frame gets an `ERROR` instead of taking effect (the connection stays open). Both are optional — omit either to allow everything. `connection.cookies`/`connection.headers` (from the WebSocket handshake, before any STOMP frame arrives) are available on `connection` in both, alongside STOMP's own `login`/`passcode` frame headers — read a session cookie here for cookie-based auth instead of requiring clients to send credentials in the `CONNECT` frame.

`connectionMetadata` is a plain struct, empty until `authenticate()` populates it — mutations persist for the life of the connection (the same struct instance every later `authorize()` call for that connection receives) and are echoed back to the client as extra `CONNECTED` headers. Attach whatever per-connection state your app needs once at connect time (a user id, a tenant, roles) instead of re-deriving it on every frame.

`stomp.send(destination, data, headers)` is the server-side publish path for app code outside any connection's own message handling — `data` is JSON-serialized unless it's already a simple value.

### Receipts

Any client frame carrying a `receipt` header gets a `RECEIPT` frame back once it's been processed — not just `DISCONNECT`. If processing that frame itself failed, the `ERROR` frame carries the matching `receipt-id` instead.

### Acknowledgment (ACK/NACK)

`SUBSCRIBE`'s `ack` header — `"auto"` (default), `"client"`, or `"client-individual"` — controls whether the client must explicitly acknowledge each `MESSAGE`. Under `"client"`/`"client-individual"`, every `MESSAGE` carries an `ack` header the client references in a later `ACK`/`NACK` frame's `id` header. `"client"` mode is cumulative — acking one message also acks every earlier unacked message on that subscription, per spec. An unknown/already-acked `id` gets an `ERROR`. `NACK` is bookkeeping-identical to `ACK` here: this broker delivers straight to open connections with no message queue to redeliver into, so the positive/negative distinction real brokers use to drive redelivery has nothing to act on.

### Transactions

`BEGIN transaction:tx-1` / `COMMIT` / `ABORT` scope a set of `SEND`/`ACK`/`NACK` frames (via their own `transaction` header) so they take effect together on `COMMIT` or are discarded on `ABORT` — scoped to one connection, per spec. A `RECEIPT` for a buffered frame is sent when the frame is accepted into the transaction, not deferred to `COMMIT` (STOMP's receipt semantics are "frame accepted," not "transaction contents individually confirmed").

### Heartbeats

Negotiated per spec section 6: send a `heart-beat:cx,cy` header on `CONNECT` (`cx` = fastest interval you can send at, `0` if you can't; `cy` = interval you want to receive at, `0` if you don't want any) and the server computes both directions independently — `heartbeatMs` (if configured) is this server's own capability in both directions, `max()`'d against what the client asked for. A client that sends no `heart-beat` header defaults to `"0,0"` (no heartbeats either way) even if the server is configured for them. When an incoming interval is negotiated, the server also monitors it: if nothing arrives (a real frame or a bare heartbeat) within roughly 2x that interval, it sends an `ERROR` and closes the connection.

`Sec-WebSocket-Protocol` negotiation (`v12.stomp`/`v11.stomp`/`v10.stomp`) is handled automatically by `app.ws()`'s handshake, for client libraries (stomp.js and others) that send and expect it echoed — harmless to every other `app.ws()` route, since a client that never sends that header skips negotiation entirely.

### Exchanges & bindings

AMQP-style destination routing — not part of core STOMP itself, but a proven pattern real STOMP brokers (including Ortus's own [SocketBox](https://github.com/coldbox-modules/SocketBox), whose exchange design this mirrors) layer on top. A destination prefixed `"exchangeName/rest"` routes through the exchange registered under that name; anything else (no `"/"`, or a prefix that isn't a configured exchange name) routes through the always-present `direct` exchange with the whole destination string as the routing key — so every destination that never uses the `"exchangeName/..."` convention behaves exactly as it did before exchanges existed:

```bxs
stomp = new bxModules.boxexpress.models.middleware.Stomp( {
    exchanges: {
        direct: { bindings: { "orders.created": "notifications" } },
        topic: { bindings: { "chat.room.*": "chatFanout", "sys.##": "sysAll" } },
        fanout: { bindings: { "myFanout": [ "dest1", "dest2" ] } },
        distribution: { type: "roundrobin", bindings: { "myDist": [ "destA", "destB" ] } }
    }
} )
```

- **`direct`** (always configured even if omitted) — routes a destination through `bindings` if one matches, or passes it through unchanged otherwise.
- **`topic`** — wildcard matching over dot-separated segments: `*` matches exactly one segment, `#` matches zero or more remaining segments (the standard AMQP convention — note `#` needs to be written as `##` inside a BoxLang string literal, since a bare `#` starts string interpolation; `"sys.##"` is the one-character pattern `sys.#`). Every binding whose pattern matches gets routed to, not just the first — a topic message can reach multiple destinations.
- **`fanout`** — one binding name routes to every destination in its array.
- **`distribution`** — the opposite of fanout: one binding name routes to exactly one destination from its array, chosen by `"random"` (default) or `"roundrobin"`.
- **A custom exchange** — any name other than the four built-ins, with a `class` pointing to a dotted class path implementing `route(destination, body, headers)` (returning an array of physical destinations to deliver to) — duck-typed, no formal interface.

`stomp.getExchanges()` returns the configured exchange instances, for debugging.

### Connection registry

`stomp.getConnections()` returns every currently-`CONNECT`ed client, keyed by an internal connection id, each entry `{ connection, login, connectionMetadata }` — automatically populated on `CONNECT` and cleared on disconnect. `stomp.getConnectionDetails(connectionId)` reads one entry. `stomp.getSubscriptions()` and `stomp.getConfig()` round out the introspection surface — these return live internal structs, meant for debugging/ops, not a stable data API to build app logic against.

### Server-side listeners

React to messages routed to a destination from plain server code, without opening a WebSocket connection:

```bxs
stomp = new bxModules.boxexpress.models.middleware.Stomp( {
    listeners: {
        "audit-log": ( message ) => {
            logMessage( message.getBody() )   // auto-JSON-deserialized if content-type is application/json
            // message.getConnection() is the originating WebSocketConnection,
            // or null if this arrived via stomp.send() from server code
        }
    }
} )
```

A listener's own exception is caught and logged, not allowed to break delivery to real subscribers or other listeners on the same destination. The message object exposes `getCommand()`/`getBody()`/`getBodyRaw()`/`getHeaders()`/`getHeader()`/`getConnection()`.

### What's still not built

This is a real, if intentionally smaller, first version — not the whole STOMP ecosystem some brokers support. Deliberately not built: **binary bodies** (the underlying WebSocket transport here only carries text frames, so this is a hard limit of the transport, not a broker choice — `content-length` is honored on read/write so a body containing an embedded NUL byte still round-trips correctly, but genuinely binary octets can't). Destination matching (both the subscriber registry and exchange bindings) is exact-string only — `/topic/a` and `/topic/a/` are different destinations.

To relay a publish to every other process in a cluster instead of just this one's local subscribers, pass `boxExpressStomp({ cluster: app.getClusterManager() })` — see [Cluster Support](/projects/boxlang-express/docs/cluster).

Header values are escaped per the STOMP spec (backslash, newline, colon), not just stripped, so a destination or login value built from request-derived input can't break a frame's structure.

## Scheduled background jobs

If what you actually need is periodic work rather than push messaging — a cleanup job, polling an external API — see [`app.schedule()`](/projects/boxlang-express/docs/scheduler) instead; it doesn't touch WebSockets/STOMP at all.

## What this isn't

There's no rooms/presence abstraction beyond STOMP destinations, no auth/middleware chain integration for a raw `app.ws()` route (auth only exists at the STOMP layer), and no `:params` or `Router` mounting for WebSocket paths — the simplest version that covers a real route table, extended if a real need for pattern-matched paths shows up.

A small worked example — multiple channels, join/leave presence, message history, all on raw `app.ws()` with no STOMP — is live at [/games/chat](/games/chat/).
