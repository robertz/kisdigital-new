# Configuration

boxlang.json, the --bx-config flag, environment variable interpolation, and app-level settings.

## boxlang.json: global vs. project

BoxLang's CLI only auto-loads one config file: `~/.boxlang/config/boxlang.json`, the machine-wide config. A `boxlang.json` placed next to your entry script is **not** discovered automatically.

| Location | Auto-loaded? | Scope |
|---|---|---|
| `~/.boxlang/config/boxlang.json` | Yes, always | Every BoxLang process on the machine |
| `./boxlang.json` (project-local) | No — requires `--bx-config` | Only when explicitly passed |

## Using --bx-config

```bash
boxlang --bx-config ./boxlang.json app.bxs
```

Other useful global CLI flags (from `boxlang --help`):

| Flag | Purpose |
|---|---|
| `--bx-config <PATH>` | Use a custom configuration file |
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

Unlike `boxlang.json`, a `.env` file in the current working directory **is** loaded automatically — no flag needed. This was confirmed directly: a script run from a directory containing a `.env` with `MY_VAR=value` saw it via `System.getenv("MY_VAR")`; the same script run one directory over, with no `.env` present, didn't.

```plain
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=myapp
MYSQL_USERNAME=root
MYSQL_PASSWORD=super-secret
```

This is what the `${env.VARIABLE_NAME:defaultValue}` placeholders above actually resolve against day to day — a `.env` file per environment (gitignored, never committed) is the natural way to supply real values locally without exporting shell variables or hardcoding secrets into `boxlang.json` itself.

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
| `"views"` | Directory `res.render()` resolves view files from. See [Views & Templates](/projects/boxlang-express/docs/views). |
| `"view engine"` | Default extension appended to a view name with no extension (defaults to `"bxm"`). |
| `"env"` | When set to `"development"`, the default 500 handler exposes the real error message instead of a generic one. Custom error middleware can read this the same way — see [Error Handling](/projects/boxlang-express/docs/errors). |
| `"trust proxy"` | When `true`, `req.ip` prefers the first address in `X-Forwarded-For` over the direct TCP peer. Off by default — an untrusted client could otherwise forge that header to spoof its IP. |
| `"trust proxy header"` | A header name, or an ordered array of candidates, checked before `X-Forwarded-For` and independent of the `"trust proxy"` boolean — see below. |
| `"reloadOnChange"` | Dev-mode auto-restart on file change. See [Process Lifecycle](/projects/boxlang-express/docs/lifecycle). |

```bxs
app.set( "env", "development" )
app.set( "trust proxy", true )
app.set( "views", expandPath( "./views" ) )
```

### "trust proxy header" — for platforms where X-Forwarded-For can be forged

`X-Forwarded-For` isn't safe to trust on every platform, even with `"trust proxy"` on. Confirmed directly against DigitalOcean App Platform (with Cloudflare in front of that): both hops _append_ to `X-Forwarded-For` rather than replacing it, so a client can prepend a forged entry and have it survive to the app — making `req.ip` attacker-controlled, not just wrong.

Platforms like this typically also inject their own edge-set header carrying the real client IP — set from the connection the edge itself observed, not anything the client sent. `"trust proxy header"` checks one or more of those by name, in order, and uses the first one present:

```bxs
app.set( "trust proxy header", [ "DO-Connecting-IP", "CF-Connecting-IP" ] )
```

This is what this site itself runs behind (DO App Platform, Cloudflare-proxied) — see `app.bxs`. Other platforms set their own equivalent (`Fastly-Client-IP`, etc.) — check with your host.
