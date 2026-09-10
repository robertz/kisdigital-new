# Cluster Support

`app.getClusterManager()` — cross-process peer discovery and manager election, for running more than one instance of an app behind a load balancer.

## The problem this solves

Both the [Scheduler](/projects/boxlang-express/docs/scheduler) and [STOMP](/projects/boxlang-express/docs/websockets) started out with the same boundary around themselves: every process instance runs independently, with no awareness of any other instance. Fine for a single process, but a real problem the moment there's more than one behind a load balancer — a "run once a minute" scheduled job fires once *per instance*, and a STOMP publish only ever reaches subscribers connected to that same instance.

`app.getClusterManager()` lazily builds one shared `ClusterManager` for the app, backed by a durable, shared `cache()`, so instances never need to know each other's addresses in advance — each one registers its own identity and reads everyone else's back from the same cache. Two independent consumers are built on top of it: clustered scheduled jobs, and a STOMP relay mesh.

## Enabling it

Off by default — an app that never opts in pays nothing for any of this. Configuration, in increasing precedence — module default (off) → `boxlang.json` → `app.set("cluster", {...})`:

```json
{
	"modules": {
		"boxexpress": {
			"settings": {
				"cluster": {
					"enabled": true,
					"name": "ws://10.0.1.4:3000",
					"cacheProvider": "clusterPeers",
					"secretKey": "${env.CLUSTER_SECRET}"
				}
			}
		}
	}
}
```

| Option | Required | Effect |
|---|---|---|
| `enabled` | — | Off by default. Every `ClusterManager` method is a no-op until this is `true` — a clustered job runs on every instance, same as an unclustered one, and `options.cluster` on `boxExpressStomp()` relays nothing. |
| `name` | when enabled | This instance's own identity, written to the shared cache as its heartbeat key — typically a reachable `ws://` URL for the relay mesh to dial. |
| `cacheProvider` | when enabled | The name of a `boxlang.json` cache backed by a genuinely durable/shared object store. |
| `secretKey` | recommended | Gates the relay mesh's `/__cluster` endpoint — every instance must share the same value, sourced from an environment variable, never a literal in source. |
| `peerIdleTimeoutSeconds` | — | Default `30`. How long a missed heartbeat is tolerated before a peer is considered gone. |

`cacheProvider` is validated at startup via BoxLang's own `IObjectStore.isDistributed()` (`true` for `JDBCStore`, `false` for the in-memory `ConcurrentStore` default) — not just documented as a footgun. A store that reports `isDistributed() == false` can still be allowed explicitly via `allowedObjectStores`. See [Sessions](/projects/boxlang-express/docs/sessions) for the same `JDBCStore` cache setup, including its own `autoCreate` gotcha.

## Clustered scheduled jobs

```bxs
app.schedule( 60000, () => {
    sendDailyDigest()
}, { clustered: true } )
```

Only the elected instance actually runs a clustered job's tick; every other instance does nothing for it, not even the overlap bookkeeping a normal job gets. Failover is passive: if the elected instance goes down, the next instance to check discovers its heartbeat has gone stale and promotes itself, within roughly one heartbeat cycle. See [Scheduler](/projects/boxlang-express/docs/scheduler) for everything else about `app.schedule()`.

## STOMP relay mesh

```bxs
stomp = boxExpressStomp( { cluster: app.getClusterManager() } )
app.ws( "/stomp", stomp.handler() )
```

Opens a mesh of outbound WebSocket connections to every live peer. A `SEND`/`stomp.send()` that would otherwise only reach local subscribers is also relayed to every other instance, which delivers it to *its own* local subscribers through the exact same subscriber/exchange/listener path a real client's `SEND` uses. A message that arrives via the relay is never relayed back out, so it can't loop. See [WebSockets](/projects/boxlang-express/docs/websockets) for everything else about the STOMP broker.

## Inspecting the cluster

```bxs
app.get( "/admin/cluster", ( req, res ) => {
    res.json( app.getClusterManager().getClusterMembers() )
} )
```

`getClusterMembers()` returns every live peer plus this instance's own name — the "who's actually in the cluster" view for a status endpoint or dashboard.

## What's not built

Explicit non-goals for this first version:

- **No per-job leader affinity** — one elected instance runs *every* clustered job in the app, not different jobs on different instances.
- **No general peer-to-peer RPC** — the relay only ever carries a STOMP publish.
- **No binary relay payloads** — the envelope is JSON text, matching STOMP's own transport limits.

See [ClusterManager.bx](https://github.com/robertz/boxlang-express/blob/main/models/cluster/ClusterManager.bx) and [plans/cluster-support.md](https://github.com/robertz/boxlang-express/blob/main/plans/cluster-support.md) in the repo for the full design.
