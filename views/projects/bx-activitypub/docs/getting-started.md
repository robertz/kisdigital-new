# Getting Started

Requirements, installation, and a complete app that federates one account and one post.

## Requirements

- BoxLang 1.17+
- MySQL 8.0.13+ (the module's tables use `UUID_TO_BIN` and expression defaults), through a BoxLang datasource (`bx-mysql`)
- A public HTTPS hostname. Other servers must be able to reach you, and your hostname becomes part of every account's identity.
- [boxlang-express](/projects/boxlang-express) for the bundled routes adapter. The core module doesn't depend on it.

## Install

```bash
install-bx-module bx-activitypub
```

or with CommandBox: `box install bx-activitypub`. Then create the tables in your app's database from the module's `sql/schema.sql`:

```bash
mysql your_database < boxlang_modules/bx-activitypub/sql/schema.sql
```

That path is for an install into your app's own `boxlang_modules/` (with `--local`). The module adds seven `Ap*` tables and never reads or writes any of yours. Its classes are available as `bxModules.bxactivitypub.*`.

### Upgrading

Run each upgrade script once, in order, for every version you're moving past:

| From | Run |
|---|---|
| 0.1.x | `sql/upgrade-0.2.0.sql` |
| anything before 0.4.0 | `sql/upgrade-0.4.0.sql` |
| anything before 0.5.0 | `sql/upgrade-0.5.0.sql` |
| anything before 0.6.0 | `sql/upgrade-0.6.0.sql` |

## How it fits together

You implement one class, `IHostApp`, which answers four questions about your data. The module does everything else:

```plain
your app ── IHostApp ──> bx-activitypub ──> signed HTTP ──> Mastodon, etc.
   │                          │
   └── express adapter ───────┘  (mounts the routes on your BoxExpress app)
```

See [The Host Contract](/projects/bx-activitypub/docs/host-contract) for exactly what each method returns.

## Minimal example

A blog with one account, `@blog`, and one post. Put these three files in one folder, install the modules into it, and create the tables:

```bash
install-bx-module bx-activitypub,boxlang-express,bx-mysql --local
mysql -e "CREATE DATABASE mydb"
mysql mydb < boxlang_modules/bx-activitypub/sql/schema.sql
```

**MyHost.bx**

```bxs
class implements="bxModules.bxactivitypub.contracts.IHostApp" {

    string function baseUrl() {
        return getSystemSetting( "PUBLIC_BASE_URL", "https://example.com" );
    }

    function findActor( required string type, required string name ) {
        if ( type == "Person" && name == "blog" ) {
            return {
                id          : "7d5c1f2e-3a4b-4c5d-8e6f-000000000001",
                name        : "blog",
                displayName : "My Blog",
                summary     : "<p>New posts from my blog.</p>",
                avatar      : "",
                url         : baseUrl() & "/"
            };
        }
        return javacast( "null", "" );
    }

    function getObject( required string type, required string id ) {
        if ( type == "post" && id == "7d5c1f2e-3a4b-4c5d-8e6f-000000000101" ) {
            return {
                author    : "blog",
                title     : "Hello, fediverse",
                summary   : "My first federated post.",
                content   : "<p>Hello from BoxLang.</p>",
                url       : baseUrl() & "/posts/hello-fediverse",
                published : parseDateTime( "2026-10-01T12:00:00Z" )
            };
        }
        return javacast( "null", "" );
    }

    boolean function isPublic( required string type, required string id ) {
        return true;
    }

}
```

**app.bxs**

```bxs
app  = boxExpress()
host = new MyHost()
ap   = new bxModules.bxactivitypub.models.ActivityPub( host = host, settings = { datasource : "mydb" } )

// Routes (WebFinger, actors, inboxes, posts, NodeInfo) and the delivery worker.
new bxModules.bxactivitypub.adapters.express().mount( app, ap )

// Your own pages. Mount them after the adapter: it answers ActivityPub
// requests and passes everything else through.
app.get( "/", ( req, res ) => res.send( "My Blog" ) )

// Send new posts, edits and deletions every two minutes.
app.schedule( 2 * 60 * 1000, () => {
    ap.syncPost( "7d5c1f2e-3a4b-4c5d-8e6f-000000000101" )
    ap.syncActor( "Person", "blog" )
}, { name : "activitypub-sync" } )

app.listen( 3000 )
```

**boxlang.json**

```json
{
    "datasources": {
        "mydb": {
            "driver": "mysql",
            "host": "127.0.0.1",
            "port": "3306",
            "database": "mydb",
            "username": "root"
        }
    },
    "logging": {
        "loggers": {
            "activitypub": { "level": "DEBUG", "appender": "file", "encoder": "text", "additive": false }
        }
    }
}
```

Run it behind your HTTPS hostname:

```bash
PUBLIC_BASE_URL=https://your.host boxlang --bx-config ./boxlang.json app.bxs
```

Then search Mastodon for `@blog@your.host`, follow it, and the post arrives within two minutes. Check it without Mastodon:

```bash
curl "https://your.host/.well-known/webfinger?resource=acct:blog@your.host"
curl -H "Accept: application/activity+json" https://your.host/u/blog
```

> [!WARNING] Some things are permanent
> Choose your hostname and handles before you federate for real: changing either orphans every follower. See [Publishing](/projects/bx-activitypub/docs/publishing) for the rest of what can't be undone.

## Development

```bash
box install
mysql -e "CREATE DATABASE bxactivitypub_test"
box run-script test
```

Tests use the `bxactivitypub_test` database (see `tests/boxlang.json`). `examples/dev-host/` in the repo is a small app for trying the module over a tunnel.
