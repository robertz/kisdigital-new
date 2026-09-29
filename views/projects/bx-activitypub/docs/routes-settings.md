# Routes & Settings

What the express adapter mounts, and the settings the module takes.

## Mounting

```bxs
new bxModules.bxactivitypub.adapters.express().mount( app, ap, options )
```

Mount it before your own routes. Account and post routes answer ActivityPub requests (`Accept: application/activity+json`); a browser asking for the same path is redirected to the `url` from your host, and anything else passes through to your app.

The adapter reads its own settings (the last four in the [settings table](#settings)); `options` overrides them for one mount. `inboxRateLimit` keys on `req.ip`, so behind a proxy set `trust proxy` or `trust proxy header` first.

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

Every setting has a default in the module's `ModuleConfig.bx`. Override any of them in your app's `boxlang.json`; `${env.NAME:default}` placeholders work too:

```json
{
	"modules": {
		"bxactivitypub": {
			"settings": {
				"datasource": "${env.AP_DATASOURCE:mydb}",
				"inboxRateLimit": 300
			}
		}
	}
}
```

Settings passed in code, to `new ActivityPub( host, settings )` or `mount( app, ap, options )`, win over both. `ap.getSettings()` returns the settings in effect.

| Setting | Default | |
|---|---|---|
| `datasource` | _required_ | Where the `Ap*` tables live |
| `maxAgeSeconds` | `3600` | Oldest signed `Date` accepted on incoming requests |
| `maxFutureSeconds` | `300` | Furthest-ahead signed `Date` accepted |
| `httpTimeoutSeconds` | `10` | Outgoing connect and request timeout |
| `userAgent` | `bx-activitypub/{version} (+{baseUrl})` | Outgoing `User-Agent` |
| `maxResponseBytes` | `1048576` | Largest response read from another server |
| `remoteActorTtlSeconds` | `86400` | How long a fetched remote account (inbox, key) is used before refetching |
| `remoteActorFailureSeconds` | `300` | How long a remote account that couldn't be fetched isn't tried again |
| `softwareName`, `softwareVersion` | `bx-activitypub`, module version | Reported in NodeInfo |
| `threadMaxPostAgeDays` | `30` | Posts older than this aren't followed by `fetchThreads()` |
| `threadMaxDepth` | `3` | Levels below a delivered reply that `fetchThreads()` follows |
| `threadMaxNewPerRun` | `50` | New replies fetched per `fetchThreads()` run |
| `threadWalkMinutes` | `30` | How often each reply's replies are re-read |
| `maxInboxBytes` | `262144` | Largest inbox POST body accepted |
| `inboxRateLimit` | `120` | Inbox POSTs per client IP per minute; `0` for no limit |
| `deliveryIntervalMs` | `5000` | Delivery worker tick; `0` to run `ap.processDeliveries()` yourself |
| `threadIntervalMs` | `1800000` | How often [whole threads](/projects/bx-activitypub/docs/replies#whole-threads) are fetched; `0` to run `ap.fetchThreads()` yourself |
