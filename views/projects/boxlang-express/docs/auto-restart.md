# Auto-Restart

`app.set( "reloadOnChange", true )` — a dev-only convenience that restarts your app when source files change.

## Turning it on

```bxs
app.set( "reloadOnChange", true )
```

This watches the entry script's directory (recursively, skipping dot-directories and `node_modules`/`boxlang_modules`/`target`/`build`/`dist`) for `.bx`/`.bxs` changes, debouncing bursty save events (most editors fire two or three filesystem events per save) into one restart. Note that it's the entry script's directory, not the working directory you launched from.

Registration is a one-time recursive snapshot taken at startup — a directory created _after_ the server starts won't be picked up until the next restart. That's an accepted limitation for a dev-only convenience feature.

`.bxm` view files aren't watched — only `.bx`/`.bxs` are. A restart is only _necessary_ for `app.bxs` itself (or any other `.bx` class file it loads) — that code runs once at process start, so editing `app.get(...)` registrations or anything else at the top level does nothing until the script re-executes. A `.bxm` view is different: `res.render()` runs it via `include`, which re-reads the file from disk on every request as long as `trustedCache` is off (the default), so a view edit shows up on the next request with no restart at all.

`reloadOnChange` is separate from `app.set( "env", "development" )` — use either independently.

## How it works: a supervisor and a child

There's no hot reload inside a running JVM once BoxLang has compiled your classes, so a restart means a new process. As of 0.2.22, the process you start becomes a **supervisor**, and your app runs in a **child process**:

1. Your script runs up to `app.listen()`. In the supervisor, `listen()` doesn't bind the port — it starts the child with the same command line (replayed via `ProcessHandle.current()`, so it works whatever the entry script is named and however it was launched: bvm-managed `boxlang`, a raw `java -jar`, custom JVM flags) and starts watching files.
2. The child runs your script again from the top and serves requests as normal.
3. On a change, the supervisor logs `[reloadOnChange] <path> changed — restarting...`, stops the child with `SIGTERM`, waits for it to exit (force-killing it after 10 seconds), and only then starts a new one. The old server has always released the port before the new one binds it.
4. If the child exits on its own — a syntax error in what you just saved, a startup exception, `app.close()` — the supervisor logs `[reloadOnChange] app exited with code N — waiting for a file change to restart.` and starts it again on your next save. Fix the file and it comes back.

Before 0.2.22, a restart spawned a replacement and exited, so the process your shell, IDE or container started was gone after the first save: Ctrl+C no longer reached the server, a container whose PID 1 it was stopped outright, and a startup error in the saved code left nothing watching for the fix. The supervisor stays alive for the whole session instead:

- **Ctrl+C** stops both — the terminal sends it to the supervisor and the child together.
- **`SIGTERM` to the supervisor** (`kill`, `docker stop`, an IDE's stop button) stops the child first, then exits.
- **If the supervisor is killed outright** (`kill -9`), the child notices within a second and exits, so no server is left running in the background.
- **In a container**, the supervisor can be PID 1 and the container keeps running across restarts.

## What runs where

- Code **after** `app.listen()` never runs in the supervisor, because `listen()` blocks there.
- Code **before** `app.listen()` runs in both processes. Registering routes and middleware there is harmless, and `app.schedule()` jobs and the cluster manager are shut down in the supervisor so they only run in the child. Anything else with side effects at the top of your script (a migration, a log line) runs once more, in the supervisor, at startup — move it after the routes or guard it if that matters.
- The `listen()` callback runs only in the child.
- The child stops immediately on a restart instead of waiting for in-flight requests, so an open SSE stream doesn't hold up every save. Set `app.set( "shutdownTimeoutMs", ms )` to drain instead (see [Health Checks & Graceful Shutdown](/projects/boxlang-express/docs/health-and-shutdown)).

Dev mode runs two JVMs, so expect roughly double the memory of a plain `boxlang app.bxs`.

## Using an external watcher instead

Any restart tool that runs your app as its own child process works with BoxExpress unchanged. Leave `reloadOnChange` off and let the tool do the watching:

```bash
watchexec -r -e bx,bxs -- boxlang app.bxs
```

```bash
nodemon -e bx,bxs --exec boxlang app.bxs
```

```bash
find . -name '*.bx' -o -name '*.bxs' | entr -r boxlang app.bxs
```

Reasons to prefer one:

- **Finer control** over what's watched (globs, ignore files, several directories) and when it restarts (debounce, clear screen, notifications).
- **One JVM**, and your script runs once per restart instead of twice.
- **Your team already uses one** for other languages.

`SIGTERM` from these tools runs BoxExpress's normal graceful shutdown, so in-flight requests finish first.
