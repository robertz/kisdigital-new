# Getting Started

Install BoxLang Express, write a minimal server, and run it.

## Prerequisites

You need the BoxLang CLI itself installed (e.g. via [bvm](https://bx.dev), the BoxLang version manager).

## Installing BoxLang Express

`box install boxlang-express` or `install-bx-module boxlang-express`

## Your first server

Once the module resolves, `boxExpress()` and its companion middleware BIFs (`boxExpressJSON()`, `boxExpressStatic()`, etc.) are available globally — no `import` needed. Save this as `app.bxs`:

```bxs
app = boxExpress()

app.get( "/", ( req, res ) => {
    res.send( "Hello World" )
} )

app.listen( 3000, ( port ) => {
    println( "listening on #port#" )
} )
```

## Running the server

Run it directly with the CLI:

```bash
boxlang app.bxs
```

By default `app.listen()` blocks the calling thread — it keeps the process alive for you, the same role Node's event loop plays for an Express app, since BoxLang's CLI runtime has no equivalent of its own. Stop it with `Ctrl-C`; see [Process Lifecycle](/projects/boxlang-express/docs/lifecycle) for exactly what happens on shutdown.

Need a config file (datasources, module settings, etc.)? See [Configuration](/projects/boxlang-express/docs/config) — the CLI doesn't pick one up automatically, so there's a flag for it.

## Dev-mode auto-reload

Add one line to restart the process automatically whenever a watched `.bx`/`.bxs`/`.bxm` file changes:

```bxs
app.set( "reloadOnChange", true )
```

Full mechanics — including a real caveat about orphaned processes from before this was hardened — are covered in [Process Lifecycle](/projects/boxlang-express/docs/lifecycle).
