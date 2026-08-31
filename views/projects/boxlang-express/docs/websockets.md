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

`middleware/Stomp` layers destination-based messaging (`SUBSCRIBE`/`SEND`, STOMP 1.2) on top of `app.ws()` — the shape most chat/notification/live-update use cases actually want, rather than tracking connections and destinations by hand:

```bxs
stomp = boxExpressStomp()
app.ws( "/stomp", stomp.handler() )

app.post( "/orders", ( req, res ) => {
    stomp.send( "/topic/orders", { orderId: newOrder.id } )   // server-side publish
} )
```

Options passed to `boxExpressStomp({ ... })`:

- `authenticate(login, passcode, host, connection)` — gates `CONNECT`.
- `authorize(login, destination, access, connection)` — gates `SUBSCRIBE`/`SEND`; `access` is `"subscribe"` or `"publish"`.
- `heartbeatMs` — server-sent keepalive interval.

Destination matching is exact-string only — no wildcard topics. Not implemented: exchanges/bindings, transactions (`BEGIN`/`COMMIT`/`ABORT`), client `ACK`/`NACK`, binary frame bodies, or bidirectional heartbeat negotiation.

## What this isn't

There's no rooms/presence abstraction beyond STOMP destinations, no auth/middleware chain integration for a raw `app.ws()` route (auth only exists at the STOMP layer), and no `:params` or `Router` mounting for WebSocket paths — the simplest version that covers a real route table, extended if a real need for pattern-matched paths shows up.

A small worked example — multiple channels, join/leave presence, message history, all on raw `app.ws()` with no STOMP — is live at [/games/chat](/games/chat/).
