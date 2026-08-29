# Views & Templates

res.render(), the two supported template engines, and sharing layout across pages.

## Setting up a views directory

```bxs
app.set( "views", expandPath( "./views" ) )
```

Every view path passed to `res.render()` is resolved against this directory, with a containment check — a view path can't escape it, even if built from user input.

## Two engines, picked by extension

| Extension | Engine |
|---|---|
| `.bxm` | Native BoxLang template — `data` is available as a struct, interpolation needs a `<bx:output>` block, same as classic CFML `<cfoutput>` |
| `.hbs` | Handlebars — `data` is the render context directly, so template variables are `{{whatever}}` |

A view name with no extension gets one appended based on `app.set("view engine", ...)`, defaulting to `"bxm"`.

### .bxm example

```bxs
app.get( "/greet/:name", ( req, res ) => {
    res.render( "greeting", { name: req.params.name } )
} )
```

```html
<!-- views/greeting.bxm -->
<bx:output><h1>Hello, #data.name#!</h1></bx:output>
```

### .hbs example

```bxs
app.get( "/greet-hbs/:name", ( req, res ) => {
    res.render( "greeting.hbs", { data: { name: req.params.name, things: [ "a", "b", "c" ] } } )
} )
```

```handlebars
<!-- views/greeting.hbs -->
<h1>Hello, {{data.name}}!</h1>
<p>Things: {{#each data.things}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}</p>
```

## Sharing layout with partials

`.bxm` templates are just BoxLang, so ordinary `<bx:include>` works for shared header/footer/nav — this documentation section is built exactly this way, with every page including the same head/foot partials:

```html
<!-- views/docs/some-page.bxm -->
<bx:include template="../partials/_head.bxm">
<bx:output>
  <h1>Page content#data.title#</h1>
</bx:output>
<bx:include template="../partials/_foot.bxm">
```

Included paths resolve relative to the including template's own directory, same as a plain CFML/BoxLang `include` — no special wiring from the framework is needed.

> [!NOTE] How this page is put together
> This doc page's sidebar isn't hardcoded per page — the route handler reads an ordered array of `{page_slug, title}` topics from a static per-project registry and passes it, along with which one is current, into a single shared `_docsShell.bxm` shell. The shell loops the array to render the sidebar's active-state links, then interpolates the current page's pre-rendered HTML — pre-rendered once server-side through the markdown renderer, not `<bx:include>`d per page, since the content itself is stored as a `.md` file (read via `fileRead()`) rather than a `.bxm` file — the same "shared shell, dynamic content" pattern shown above, just sourced from a markdown file instead of an inline template.

## app.locals / res.locals

Two plain structs merged into every `render()` call's data, so values a route doesn't set explicitly — a site name, the current user, shared nav data — don't have to be threaded through every single `res.render()` call by hand. `app.locals` is set once, application-wide; `res.locals` is set per request (typically from middleware) and only lives for that one request/response cycle. Precedence, low to high: `app.locals`, then `res.locals` (overriding `app.locals`), then whatever you pass as `render()`'s own `data` argument (overriding both):

```bxs
app.locals.siteName = "My Site"

app.use( ( req, res, next ) => {
    res.locals.user = req.session.user ?: "guest"
    next()
} )

app.get( "/", ( req, res ) => {
    res.render( "home", {} )   // views/home.bxm sees data.siteName and data.user
} )
```

## Quick debugging without a view

For a one-off inspection route, `res.dump()` skips views entirely and sends BoxLang's own rich HTML dump of any variable:

```bxs
app.get( "/debug", ( req, res ) => {
    res.dump( { req: req.query, session: req.session } )
} )
```
