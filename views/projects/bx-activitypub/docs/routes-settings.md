# Routes & Settings

What the express adapter mounts, and the settings the module takes.

## Mounting

```bxs
new bxModules.bxactivitypub.adapters.express().mount( app, ap, options )
```

Mount it before your own routes. Account and post routes answer ActivityPub requests (`Accept: application/activity+json`); a browser asking for the same path is redirected to the `url` from your host, and anything else passes through to your app.

| Option | Default | |
|---|---|---|
| `maxInboxBytes` | `262144` | Largest inbox POST body accepted |
| `deliveryIntervalMs` | `5000` | How often the delivery worker runs. `0` to schedule it yourself with `ap.processDeliveries()` |

## Routes

| Method | Path | |
|---|---|---|
| GET | `/.well-known/webfinger` | `acct:name@host` or an account URL |
| GET | `/.well-known/nodeinfo`, `/nodeinfo/2.1` | NodeInfo |
| GET | `/actor` | Instance account; signs outgoing requests |
| GET | `/u/{name}`, `/c/{name}` | Person and Group accounts |
| POST | `/u/{name}/inbox`, `/c/{name}/inbox`, `/inbox` | Follow, Like, Announce (boost) and their Undo; account deletions; with `IRemoteReplies`, replies (Create/Update/Delete of a Note) |
| GET | `/u/{name}/outbox`, `/c/{name}/outbox` | Empty collection |
| GET | `/u/{name}/followers`, `/c/{name}/followers` | Follower count only |
| GET | `/post/{id}` | Posts |
| GET | `/comment/{id}` | Comments that went out |
| GET | `/activities/{type}/{uuid}` | Every activity that was sent |

Ids are these stable paths, never slugs — slugs change, ids can't. Each object's `url` points at its human-facing page instead.

## Settings

Passed to `new ActivityPub( host, settings )`:

| Setting | Default | |
|---|---|---|
| `datasource` | _required_ | Where the `Ap*` tables live |
| `maxAgeSeconds` | `3600` | Oldest signed `Date` accepted on incoming requests |
| `maxFutureSeconds` | `300` | Furthest-ahead signed `Date` accepted |
| `httpTimeoutSeconds` | `10` | Outgoing connect and request timeout |
| `userAgent` | `bx-activitypub/{version} (+{baseUrl})` | Outgoing `User-Agent` |
| `softwareName`, `softwareVersion` | `bx-activitypub`, module version | Reported in NodeInfo |
