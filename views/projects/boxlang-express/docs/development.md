# Hacking on BoxExpress

Running the example server and the test suite from a checkout of the module itself.

## Requirements

BoxLang (tested against 1.15.0) on the JVM. Undertow and its transitive runtime dependencies (XNIO, JBoss Logging, etc.) are vendored in `libs/` — nothing to install for those. TestBox is the only thing that needs pulling in, and only for the test suite (`box install`).

## Running the example

```bash
boxlang examples/server.bxs
```

Then, from another shell:

```bash
curl localhost:3000/
curl localhost:3000/users/42
curl "localhost:3000/search?q=cats"
curl -X POST -H "Content-Type: application/json" -d '{"a":1}' localhost:3000/echo
curl localhost:3000/api/ping
curl localhost:3000/api/items/7
curl -i localhost:3000/public/hello.txt
curl localhost:3000/does-not-exist
curl localhost:3000/boom
curl -i localhost:3000/set-cookie
curl -i localhost:3000/go-home
curl localhost:3000/slow    # run a few of these in parallel to see concurrent handling
curl localhost:3000/greet/Ada
```

Inside the repo, `examples/` and `tests/` reference the library via relative paths (`new "../models/BoxExpress"()`) rather than the `bxModules.boxexpress` mapping. That's deliberate: a relative-path `new` resolves against the calling file's own location and works regardless of where `boxlang` is invoked from, which matters for a repo whose own scripts live in subdirectories rather than at the module root.

## Developing against a local checkout

To test unreleased changes in an app, symlink the checkout in rather than installing from ForgeBox:

```bash
mkdir -p boxlang_modules
ln -s /path/to/boxlang-express boxlang_modules/boxexpress
```

> [!WARNING] A global install shadows a local one
> If a module of the same name exists in both a project-local `boxlang_modules/boxexpress/` and a global `~/.boxlang/modules/boxexpress/`, the global copy wins. If a local change doesn't seem to take effect, check whether a global install is shadowing it.

## Tests

[TestBox](https://testbox.ortusbooks.com/) specs, run headlessly — no server needed:

```bash
boxlang setup-tests.bxs   # once per checkout
boxlang run-tests.bxs     # every time after that
```

`run-tests.bxs` exits non-zero on any failure or error, so it's CI-friendly — just run `setup-tests.bxs` once beforehand (in your CI image build step, or a `pretest` script).

| Spec | What it covers |
|---|---|
| `tests/specs/RouterSpec.bx` | Unit tests for path matching and the middleware/`next()` chain, using lightweight fake `req`/`res` structs instead of a real exchange |
| `tests/specs/BoxExpressIntegrationSpec.bx` | Spins up a real app on `localhost:4321` and hits it with real HTTP requests, exercising `Request`/`Response`/`BodyParsers`/`StaticFiles`/`render()` together, plus a concurrency check |
| `tests/specs/BifsSpec.bx` | The same idea, built entirely through the global BIFs on `localhost:4322`, to make sure the friendly entry points work, not just the underlying classes |
| `tests/specs/UndertowAdapterSpec.bx` | Regression coverage for the Undertow wiring, including reading a request body from Undertow's own I/O thread and confirming each request runs on its own virtual thread |
| `tests/specs/ProcessLifecycleSpec.bx` | Behaviors that need a real OS process boundary: a clean exit on a port conflict, a real `SIGTERM` releasing the socket, and `reloadOnChange` actually replacing the running process |

`tests/fixtures/` holds a static file and a `.bxm` view the integration specs serve and render.

`setup-tests.bxs` creates a self-referencing `boxlang_modules/boxexpress` symlink (gitignored) so BoxLang discovers the project as a real module and registers the BIFs `BifsSpec` needs. Module discovery only happens once at BoxLang process startup, so this has to run as its own invocation before `run-tests.bxs`.

## Two BoxLang-specific things that shaped the specs

- Bare (non-`var`) assignment inside a `describe`/`it`/`beforeEach` closure doesn't reliably cross into sibling closures — `RouterSpec` builds its own `var router` per test instead of sharing one via `beforeEach`. `variables.xxx` set in `beforeAll()`/`afterAll()` _does_ cross into `it()` blocks, since those are real class methods rather than closure arguments.
- `expandPath()` resolves relative to the top-level entry script (`run-tests.bxs`, at the project root), not relative to whichever `.bx` file happens to call it — hence the fixture paths are project-root-relative (`tests/fixtures/...`) rather than `../fixtures/...`.

## Further reading

- [Architecture](https://github.com/robertz/boxlang-express/blob/main/docs/ARCHITECTURE.md) — design decisions and the reasoning behind them
- [Contributing](https://github.com/robertz/boxlang-express/blob/main/CONTRIBUTING.md)
- [Changelog](https://github.com/robertz/boxlang-express/blob/main/CHANGELOG.md)
