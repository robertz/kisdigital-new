# Views

res.render(), `.bxm` templates, layouts and partials.

## Setting up a views directory

```bxs
app.set( "views", expandPath( "./views" ) )
```

Every view path passed to `res.render()` is resolved against this directory, and `render()` throws if `app.set( "views", ... )` was never called. The path is checked against the views directory's real (symlink-resolved) path before the file is run — `res.render( req.query.tpl )` with `tpl=../../etc/passwd` throws instead of rendering whatever that resolves to. Treat any user input reaching `render()`'s first argument as something to validate yourself regardless; this just stops the obvious traversal case.

## .bxm templates

```bxs
app.get( "/greet/:name", ( req, res ) => {
    res.render( "greeting", { name: req.params.name } )
} )
```

```html
<!-- views/greeting.bxm -->
<bx:output><h1>Hello, #encodeForHTML( data.name )#!</h1></bx:output>
```

`.bxm` is BoxLang's native server-page format (think `.cfm`). `data` is whatever struct you pass as `render()`'s second argument, and interpolation only happens inside a `<bx:output>` block, same as classic CFML `<cfoutput>`. A view name with no extension gets `.bxm` appended.

Output isn't escaped for you: wrap anything that came from a user in `encodeForHTML()`.

> [!NOTE] Handlebars was removed in 0.2.20
> `.hbs` views, and the vendored `handlebars-4.3.1.jar` that carried an unrelated advisory, are gone. Rendering an `.hbs` view now throws `BoxExpress.UnsupportedViewEngine` — convert those views to `.bxm`.

## Layouts

A layout is an ordinary view that wraps another one: the page shell (`<html>`, navigation, footer) written once instead of at the top and bottom of every view. Name one for the whole app (0.2.27+):

```bxs
app.set( "views", expandPath( "./views" ) )
app.set( "view layout", "layouts/main" )      // views/layouts/main.bxm
```

`res.render()` then renders the view first, and renders the layout with the view's HTML available as `data.body`:

```html
<!-- views/layouts/main.bxm -->
<bx:output>
<!doctype html>
<html>
<head><title>#encodeForHTML( data.title ?: "My Site" )#</title></head>
<body>
  #partial( "partials/nav" )#
  <main>#data.body#</main>
</body>
</html>
</bx:output>
```

`data.body` is already-rendered HTML, so output it as is. The layout sees the same `data` as the view (`app.locals`, `res.locals` and what was passed to `render()`).

Because the view runs before the layout, a view can hand values up to it by setting them on `data`: a page title, a body class, a flag for extra scripts:

```html
<!-- views/report.bxm -->
<bx:set data.title = "Quarterly report">
<bx:output><h1>#encodeForHTML( data.report.name )#</h1> ...</bx:output>
```

One render can choose differently with a `layout` key in its data (or in `res.locals`):

```bxs
res.render( "login", { layout: "layouts/bare" } )   // a different layout
res.render( "fragment", { layout: false } )         // none, just the view
```

With no `"view layout"` set, nothing changes: a view is rendered alone unless a render names a layout itself.

> [!WARNING] `layout` is a reserved key
> Since 0.2.27, `layout` in render data picks the layout. A view that was being passed its own `layout` value for some other purpose needs that key renamed.

## Partials

`partial( view, data )` renders another view and returns its HTML, for the pieces shared between pages. Call it inside a view or layout:

```html
<bx:output>
#partial( "partials/nav" )#
<bx:loop array="#data.orders#" index="order">
	#partial( "partials/order-row", { order: order } )#
</bx:loop>
</bx:output>
```

A partial sees everything the calling view does, plus what you pass it; what you pass is gone again when it returns, so it can't leak into the rest of the page. It resolves against the views directory with the same containment check as `render()`, and a partial can call `partial()` itself.

A partial sees `data`, not the caller's local variables: a loop's `order` above reaches the partial only because it's passed in, and the partial reads it as `data.order`.

`<bx:include template="partials/nav.bxm">` also works, as it always has: it's plain BoxLang. The differences: an include's path is relative to the file it's written in rather than to the views directory, and it can't be handed data of its own.

> [!NOTE] How this page is put together
> This site sets `"view layout"` to one shell that pulls in its head and foot partials, so no page view includes them itself. Each docs page is rendered through a single `projects/_docsShell` view: the route handler passes it the project's ordered `{page_slug, title}` registry, which the shell loops for the sidebar, and the page's HTML, rendered once server-side from a `.md` file. The layout then wraps the result like any other page.

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

For a one-off inspection route, `res.dump()` skips views entirely and sends BoxLang's own rich HTML dump of any variable (more under [Response](/projects/boxlang-express/docs/response#tips--tricks-resdump)):

```bxs
app.get( "/debug", ( req, res ) => {
    res.dump( { req: req.query, session: req.session } )
} )
```
