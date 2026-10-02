# Configuration

.boxlang.json, the --bx-config flag, environment variable interpolation, and app-level settings.

## Where BoxLang looks for config

BoxLang builds its configuration in layers, each one overriding the one before it:

| Order | Source | Scope |
|---|---|---|
| 1 | The defaults that ship inside BoxLang | Always loaded |
| 2 | `~/.boxlang/config/boxlang.json` | Every BoxLang process for your user account |
| 3 | `.boxlang.json` in the directory you run `boxlang` from, **or** the file named by `--bx-config` / `BOXLANG_CONFIG` | This project only |
| 4 | `BOXLANG_*` environment variables and `boxlang.*` Java system properties | Highest priority |

> [!NOTE] Changed in BoxLang 1.18
> Before 1.18 the CLI only auto-loaded the user-level file, and a project config had to be passed with `--bx-config` on every run. From 1.18.0 a `.boxlang.json` in the working directory is picked up on its own. On an older BoxLang, keep passing `--bx-config`.

## Per project: .boxlang.json

Put a `.boxlang.json` (note the leading dot) in your project root and start the app from there, with no flag:

```bash
boxlang app.bxs
```

It only needs the settings you want to change, such as the datasource and caches your app uses. Three details are worth knowing, each confirmed directly on 1.18.0 with a throwaway config that set an unusual timezone and added a cache:

- **It's found by working directory, not by script location.** `boxlang app.bxs` run from the project root loads it; `boxlang /path/to/project/app.bxs` run from somewhere else doesn't, even though the file sits right next to `app.bxs`. A start script or a service definition should `cd` into the project first. In a Dockerfile, `WORKDIR` does that.
- **The name has to be exact.** A `boxlang.json` without the leading dot is not discovered.
- **Settings merge by top-level key.** If `.boxlang.json` defines `datasources`, that whole block replaces the one in your user-level file rather than being combined entry by entry. Repeat anything you still need.

Commit `.boxlang.json` so everyone on the project shares the same settings, and keep secrets out of it with the `${env.NAME}` placeholders described below.

## Using --bx-config

To use a different file for one run, a CI job, or a deployment, name it explicitly:

```bash
boxlang --bx-config ./config/staging.json app.bxs
```

The explicit file is an alternative to `.boxlang.json`, not a layer on top of it: when `--bx-config` or `BOXLANG_CONFIG` is given, BoxLang uses that file and doesn't look in the working directory at all. Run with both present, the cache defined only in `.boxlang.json` was not loaded.

Other useful global CLI flags (from `boxlang --help`):

| Flag | Purpose |
|---|---|
| `--bx-config <PATH>` | Use a specific configuration file instead of `.boxlang.json` |
| `--bx-home <PATH>` | Set the BoxLang runtime home directory |
| `--bx-debug` | Enable debug mode with startup timing |
| `--bx-code <CODE>` | Execute inline BoxLang code, no file needed |

## Environment variable interpolation

Any BoxLang config file supports `${env.VARIABLE_NAME:defaultValue}` placeholders — the default is used when the environment variable is unset, so secrets and per-environment values never need to be hardcoded:

```json
{
  "datasources": {
    "main": {
      "driver": "mysql",
      "host": "${env.MYSQL_HOST:localhost}",
      "port": "${env.MYSQL_PORT:3306}",
      "database": "${env.MYSQL_DATABASE:myapp}",
      "username": "${env.MYSQL_USERNAME:root}",
      "password": "${env.MYSQL_PASSWORD}"
    }
  }
}
```

Other built-in placeholders available in any BoxLang config file: `${boxlang-home}`, `${user-home}`, `${user-dir}`, and `${java-temp}`.

## .env files

Like `.boxlang.json`, a `.env` file in the current working directory is loaded automatically — no flag needed. This was confirmed directly: a script run from a directory containing a `.env` with `MY_VAR=value` saw it via `System.getenv("MY_VAR")`; the same script run one directory over, with no `.env` present, didn't.

```plain
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=myapp
MYSQL_USERNAME=root
MYSQL_PASSWORD=super-secret
```

This is what the `${env.VARIABLE_NAME:defaultValue}` placeholders above actually resolve against day to day — a `.env` file per environment (gitignored, never committed) is the natural way to supply real values locally without exporting shell variables or hardcoding secrets into `.boxlang.json` itself.

A real OS environment variable of the same name always wins over the `.env` file's value — confirmed the same way, by setting `MY_VAR` in the shell before running a script whose `.env` set a different value for it, and seeing the shell's value win. `.env` only fills in what isn't already set, same as the standard dotenv convention everywhere else — safe to layer under CI/production environments that already export real values.

## Adding other modules

BoxLang Express is itself just a BoxLang module — the same module system installs a broader ecosystem of modules beyond it. The datasource example above is a good example of where this comes up: things like additional JDBC driver support, security/encoding helpers, or a CFML compatibility layer all ship as separate, opt-in modules rather than being baked into the runtime.

The standard tool for this is [CommandBox](https://commandbox.ortusbooks.com/) (the `box` CLI) — it talks to [ForgeBox](https://forgebox.io), the BoxLang/CFML package registry:

```bash
box install bx-mysql
```

A few modules you'll commonly see alongside a BoxLang project:

| Module | What it's for |
|---|---|
| `bx-mysql` | MySQL JDBC driver support |
| `bx-esapi` | OWASP ESAPI-backed security/encoding utilities |
| `bx-compat-cfml` | Adobe/Lucee CFML compatibility layer |

Unlike a typical CommandBox package, a BoxLang module installs into `~/.boxlang/modules/` — **global, machine-wide** — by default, since that's where the BoxLang runtime itself looks. Pass `--local` to install it at the project level instead:

```bash
box install bx-mysql --local
```

A local install lands in `boxlang_modules/`, and if there's no `box.json` yet, `box install` creates one and records the dependency — so a teammate (or CI) cloning the project can run `box install` with no arguments to fetch everything it depends on.

## App-level settings

Separate from the CLI/runtime config above, BoxLang Express has its own small settings bag on the `app` object, set with `app.set(name, value)` and read back with `app.getSetting(name)`:

| Setting | Effect |
|---|---|
| `"views"` | Directory `res.render()` resolves view files from. See [Views](/projects/boxlang-express/docs/views). |
| `"env"` | When set to `"development"`, the default 500 handler exposes the real error message instead of a generic one. Custom error middleware can read this the same way — see [Error Handling](/projects/boxlang-express/docs/error-handling). |
| `"trust proxy"` | Which proxies' `X-Forwarded-*` headers to believe: `false` (default), a hop count, a list of proxy addresses/CIDRs, or `true`. See below. |
| `"trust proxy header"` | A header name, or an ordered array of candidates, checked before `X-Forwarded-For` and independent of `"trust proxy"` — see below. |
| `"requestId"` | When `true`, gives every request an id — `req.id`, an `X-Request-Id` response header, and the id in log lines. Off by default. See [Observability](/projects/boxlang-express/docs/observability). |
| `"requestIdHeader"` | Renames the request-id header (default `"X-Request-Id"`). |
| `"wsOrigins"` | Browser origins allowed to open any `app.ws()` route (default: same-origin only; `"*"` allows every origin). See [WebSockets](/projects/boxlang-express/docs/websockets). |
| `"reloadOnChange"` | Dev-mode auto-restart on file change. See [Auto-Restart](/projects/boxlang-express/docs/auto-restart). |
| `"wsMaxMessageSize"` | Maximum size in bytes of one incoming WebSocket message (default `1048576`, 1 MB). A larger message is refused and the connection closed with code `1009`. Set it before `listen()` — see [WebSockets](/projects/boxlang-express/docs/websockets). |
| `"wsIdleTimeoutMs"` | Drops a WebSocket connection that has sent nothing for this many milliseconds (default `0`, off). See [WebSockets](/projects/boxlang-express/docs/websockets). |
| `"shutdownTimeoutMs"` | How long `SIGTERM`/Ctrl-C wait for in-flight requests to finish (default `5000`); `0` stops immediately. See [Health Checks & Graceful Shutdown](/projects/boxlang-express/docs/health-and-shutdown). |
| `"log"` | When `false`, turns off the per-request stdout line (`[2026-08-10 10:45:41] GET /users/42 127.0.0.1`) every request otherwise gets — useful for a high-throughput deployment that doesn't want a synchronous stdout write on every request. On by default. |

```bxs
app.set( "env", "development" )
app.set( "trust proxy", 1 )
app.set( "views", expandPath( "./views" ) )
```

### "trust proxy" — which proxies to believe

`req.ip` is the direct TCP peer by default — safe, since a client can't spoof it, but wrong behind a reverse proxy (it reports the proxy's IP). `"trust proxy"` takes the same values as Express:

| Value | `req.ip` is |
|---|---|
| `false` (default) | The TCP peer |
| A number, e.g. `1` | The address the nearest _n_ proxies saw — counted from the right of `X-Forwarded-For`, where each proxy appends. `1` fits a single load balancer |
| Addresses: `[ "10.0.0.0/8", "loopback" ]` | Walks `X-Forwarded-For` from the right past each trusted address (IPs, CIDR ranges, `loopback`, `linklocal`, `uniquelocal`) and takes the first one that isn't |
| `true` | The left-most `X-Forwarded-For` entry |

Prefer a hop count or an address list. With `true`, the left-most entry is whatever the client put there whenever its proxy appends to the header rather than replacing it (most do), so a client can choose its own `req.ip` — and with it, a fresh rate-limit key per request. An invalid entry throws at `app.set()`, and hostnames in the header are never looked up in DNS.

`X-Forwarded-Proto` and `X-Forwarded-Host` are believed only when the directly connected peer is a trusted proxy.

> [!NOTE] Behavior change in 0.2.20
> `app.set( "trust proxy", 1 )` (or any number) now means one hop, as in Express. It used to mean "trust everything," the same as `true`.

### "trust proxy header" — for platforms where X-Forwarded-For can be forged

`X-Forwarded-For` isn't safe to trust on every platform, even with `"trust proxy"` on. Confirmed directly against DigitalOcean App Platform (with Cloudflare in front of that): both hops _append_ to `X-Forwarded-For` rather than replacing it, so a client can prepend a forged entry and have it survive to the app — making `req.ip` attacker-controlled, not just wrong.

Platforms like this typically also inject their own edge-set header carrying the real client IP — set from the connection the edge itself observed, not anything the client sent. `"trust proxy header"` checks one or more of those by name, in order, and uses the first one present:

```bxs
app.set( "trust proxy header", [ "DO-Connecting-IP", "CF-Connecting-IP" ] )
```

This is what this site itself runs behind (DO App Platform, Cloudflare-proxied) — see `app.bxs`. Other platforms set their own equivalent (`Fastly-Client-IP`, etc.) — check with your host.
