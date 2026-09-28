# Security & Delivery

How inbound activities are verified, how outbound ones are delivered, and how to see what's happening.

## Security

- **Inbound.** Every incoming activity the module acts on must carry a valid HTTP Signature from the activity's own actor, with a matching `Digest` and a recent `Date`. Anything it doesn't act on is acknowledged without fetching anything. The `Host` is checked against your configured base URL, so a tunnel or proxy that rewrites it can't break verification.
- **Outbound.** Requests go only to HTTPS URLs on public addresses, and a remote account's inboxes must be on its own host, so a hostile account can't aim your server at internal or third-party URLs.
- **Keys.** Every account gets an RSA keypair, generated on first need and stored in the `ApActorKey` table. Encrypt the database at rest if it's shared with anything else.

## Delivery

Deliveries are queued in `ApDelivery`, so a restart loses nothing, and several app instances can run the worker at once.

- Failed deliveries retry after 1m, 5m, 30m, 2h and 12h, then give up.
- Each run sends to up to 10 inboxes in parallel, so a slow or dead server can't hold up the rest.
- Each inbox receives its activities in the order they were created.
- Deliveries to followers are deduplicated by shared inbox.
- A `410 Gone` removes the followers behind that inbox.

The adapter runs the worker every 5 seconds by default. Pass `deliveryIntervalMs: 0` to [`mount()`](/projects/bx-activitypub/docs/routes-settings) and call `ap.processDeliveries()` yourself to run it on your own schedule.

## Logging

Everything goes to the `activitypub` logger. At `DEBUG` it records every inbound and outbound request with headers and body, which is how you debug a signature mismatch:

```json
"logging": {
    "loggers": {
        "activitypub": { "level": "DEBUG", "appender": "file", "encoder": "text", "additive": false }
    }
}
```

Leave it at the default level in production.
