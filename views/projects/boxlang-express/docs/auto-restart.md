# Auto-Restart

`app.set( "reloadOnChange", true )` — a dev-only convenience that restarts the process when source files change.

## Turning it on

```bxs
app.set( "reloadOnChange", true )
```

This watches the current working directory (recursively, skipping dotfiles and directories like `node_modules`/`boxlang_modules`/`target`/`build`/`dist`) for `.bx`/`.bxs` changes, debouncing bursty save events (most editors fire two or three filesystem events per save) into one restart:

1. A file change is detected and debounced (150ms).
2. `[reloadOnChange] <path> changed — restarting...` is logged.
3. The replacement process is launched _first_, replaying the exact original JVM invocation via `ProcessHandle.current()` — this works whatever the entry script is named and however it was launched (bvm-managed `boxlang`, a raw `java -jar`, custom JVM flags), rather than assuming a fixed `boxlang <script>` shape.
4. Only once that launch succeeds is the current server closed (releasing the port) and the old process exits — the new one binds the same port with the updated code.

Registration is a one-time recursive snapshot taken at startup — a directory created _after_ the server starts won't be picked up until the next restart. That's an accepted limitation for a dev-only convenience feature.

`.bxm` view files aren't watched — only `.bx`/`.bxs` are. A restart is only _necessary_ for `app.bxs` itself (or any other `.bx` class file it loads) — that code runs once at process start, so editing `app.get(...)` registrations or anything else at the top level does nothing until the script re-executes. A `.bxm` view is different: `res.render()` runs it via `include`, which re-reads the file from disk on every request as long as `trustedCache` is off (the default) — confirmed directly, editing a view and requesting it again immediately picked up the change with no restart at all, even with `reloadOnChange` turned off entirely. Restarting on a view-only edit isn't wrong, just redundant work the file already didn't need.

## If the restart can't launch

Launching the replacement is attempted _before_ closing the current server, not after. If it fails for any reason (a bad reconstructed command, a transient OS resource limit), that's caught and logged, and the current server is left running rather than dying with nothing to replace it.

There's no hot reload inside a running JVM once BoxLang has compiled your classes, so a restart replaces the whole process — the same net effect as running under `entr -r` or `nodemon`, just without the extra dependency.

`reloadOnChange` is separate from `app.set( "env", "development" )` — use either independently.
