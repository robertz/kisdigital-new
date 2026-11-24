# Coming from ColdBox

What carries over from ColdBox, what is different on purpose, and what is not here.

## Not ColdBox underneath

boxlang-express-mvc borrows ColdBox's shapes so the first hour feels familiar. It is not ColdBox underneath: it is a thin layer over [BoxExpress](/projects/boxlang-express), a standalone HTTP server with one thread per request, and every route it registers is an ordinary BoxExpress route.

## The one thing to read

**Handlers are singletons and requests run concurrently.** That is true in ColdBox too, but here every request really is on its own thread from the first one, with no request scope to fall back on. Anything you put in a handler's `variables` scope is shared by every request in flight:

```bxs
function show( event, rc, prc ) {
	variables.user = userService.get( rc.id )   // another request can replace this before you read it
	prc.user = userService.get( rc.id )         // per request
}
```

Keep request data in `rc`, `prc` and `var`s. Services held by handlers must be thread-safe. There is no `request`, `session`, `form` or `url` scope; never use those as variable names either, because BoxLang treats them as scopes.

## Concept map

| ColdBox | Here | Plain BoxExpress |
|---|---|---|
| `handlers/items.cfc`, `function index( event, rc, prc )` | `handlers/items.bx`, same signature | `app.get( "/items", ( req, res ) => … )` |
| `rc` (URL + FORM + route params) | `rc`: query, then body, then route params | `req.query`, `req.body`, `req.params` |
| `prc` | `prc` | `res.locals` |
| `event.getValue()`, `setValue()`, `valueExists()` | same | read the structs directly |
| `event.setView( "items/index" )` | same | `res.render( "items/index", data )` |
| implicit view `views/items/index.cfm` | `views/items/index.bxm` | none; you call `res.render()` |
| `layouts/Main.cfm`, `#view()#` | `layouts/Main.bxm`, `#view()#` | `app.set( "view layout", … )`, `#data.body#` |
| `#view( "partials/nav", args )#` | same, read as `args.x` | `#partial( "partials/nav", data )#` |
| `event.setLayout()`, `noLayout()`, `noRender()` | same | `layout` key in render data |
| `event.renderData( type = "json", data = … )` | same, for `json`, `html`, `text`, `xml` | `res.json()`, `res.send()` |
| `relocate( "items.show" )` | `event.relocate( "items.show" )` | `res.redirect( url )` |
| `event.buildLink( "items.show" )` | `event.buildLink( "items.show", { id: 1 } )` | build the string |
| `event.getHTTPMethod()`, `getHTTPHeader()` | same | `req.method`, `req.get( name )` |
| `event.setHTTPHeader()` | same | `res.set( name, value )` |
| `config/Router.cfc`, `route().to()` | `config/Router.bx`, `route().to()` | `app.get/post/…` |
| `route().withAction( {} ).toHandler()` | same | one `app.<method>()` per verb |
| `resources( "photos" )` | same seven routes | seven `app.<method>()` calls |
| `route( "/:handler/:action?" ).end()` | same, opt-in | none |
| `route().as( "name" )` | same | none |
| `preHandler`, `postHandler`, `aroundHandler` | same | middleware on the route |
| `this.prehandler_only`, `this.allowedMethods` | same | route-level middleware, one `app.<method>()` per verb |
| `flash.put()`, `flash.get()` | `event.getFlash()`, and `flash` in views | `req.session` |
| `get()`, `post()`, `group()`, `toView()`, `toRedirect()` | same (`group()` takes `pattern` only) | `app.get()`, a mounted router, `res.render()`, `res.redirect()` |
| `apiResources()`, nested `resources()` | same | one `app.<method>()` per route |
| `populateModel()`, `event.paramValue()`, `getOnly()` | on the event | assign from `req.body` |
| `announce()` and interceptors | `event.announce()`, an `interceptors` directory | call the function |
| `onMissingAction`, `onInvalidHTTPMethod` | same | a later route, a 405 route |
| `onError`, `exceptionHandler` | the app's error middleware | `app.use( ( err, req, res, next ) => … )` |
| `preProcess`, `postProcess` and the other built-in interception points | middleware | `app.use( ( req, res, next ) => … )` |
| `property name="x" inject="X"` | same, with `injector:` | construct and pass in |
| `getSetting()`, `ColdBox.cfc` | your own struct | `app.set()`, `app.getSetting()` |
| `Application.cfc` + a servlet container | `server.bxs` | `server.bxs` |

## Different on purpose

- **`rc` is a copy.** Writing to it doesn't change `req.query` or `req.body`. Route params win over the body and the query string.
- **A value sent twice is an array.** `?tag=a&tag=b` gives `rc.tag == [ "a", "b" ]`, where ColdBox gives a list. Check `isArray()` or validate with `boxExpressValidate()`.
- **`event.getValue( "x" )` with no default returns `""`** when `x` is missing. ColdBox throws.
- **`renderData()` and `relocate()` send immediately.** ColdBox defers them to the end of the request. Here, nothing after them can change the response, and calling a second one throws.
- **`renderData()` doesn't convert.** JSON takes a plain struct or array (a class instance serializes as `{}`); `html`, `text` and `xml` take a string you built.
- **`relocate()` takes its target first:** `relocate( "items.show" )` or `relocate( "/login" )`. There are no `event=` / `URL=` named arguments.
- **`preHandler` can stop the request.** If it sends a response, the action and `postHandler` don't run. That is how you write a guard.
- **Action return values are ignored.** Returning a string doesn't render it; use `renderData()`.
- **Routes fail at startup.** A route to a handler or action that doesn't exist, or a pattern BoxExpress can't match (an optional segment in the middle of a path), throws when the app starts.
- **`to()` answers every verb**, as in ColdBox. Restrict verbs with `this.allowedMethods` on the handler (a wrong verb gets a 405, which `onInvalidHTTPMethod` can answer), or with `withAction()` or `resources()` on the route.
- **An action needs an `event` argument.** A public function without one is a helper and is never routable.
- **Views are not escaped**, the same as in ColdBox. Install `bx-esapi` and use the `encodeFor…()` functions.
- **`flash` and `populateModel()` are on the event.** A handler is one shared object, so it can't hold a per-request `flash`. Use `event.getFlash()` and `event.populateModel()`.
- **`announce()` has no declared interception points.** Any name works, and one nobody listens for does nothing. Listeners take `( event, data, rc, prc )`, with no `buffer`.
- **`onMissingAction` only fires on the convention route**, and renders nothing unless it calls `setView()`.
- **Nothing reloads on its own** except `.bxm` files. Use `app.set( "reloadOnChange", true )` in development; there is no `?fwreinit`.

## Not here

- Running an existing ColdBox app, ColdBox modules (`ModuleConfig.cfc`), or CBWIRE
- Built-in interception points (`preProcess`, `preRender` and the rest), and registering interceptors at runtime. Use middleware; `res.onBeforeSend()` covers "just before the response goes out".
- HMVC modules
- Handler `onError`. Use `aroundHandler` or the app's error middleware.
- Router extras: `withSSL()`, `withNamespace()`, `withDomain()`, `toResponse()`, and `group()` options other than `pattern`
- `event.getHTMLBaseURL()`, html helper, i18n, validation (BoxExpress has `boxExpressValidate()`)
- CacheBox and LogBox integration
- Sessions as a scope. Use `boxExpressSession()` and `event.getRequest().session`.

## Escape hatches

Every convention can be bypassed for one route without leaving the framework:

- **A plain route beside MVC routes:** `route( "/health", ( req, res ) => res.send( "ok" ) )`, or register it on `app` directly.
- **`req` and `res` inside an action:** `event.getRequest()` and `event.getResponse()`. Anything BoxExpress can do (cookies, sessions, `res.sendFile()`, `res.sse()`, `res.format()`) is available there. Once `res` has sent a response, the view step is skipped.
- **Middleware in front:** `app.use( "/admin", requireAdmin, mvc.router() )`. Whatever it puts in `res.locals` arrives as `prc`.
- **More than one MVC router:** each `boxExpressMvc()` call is independent, so an admin area can have its own handlers, views and mount path.
