# Handlers & Actions

Handler classes, the `event` object, `rc` and `prc`, and the pre/post hooks.

## Handlers are shared between requests

**One instance of each handler serves every request, and requests run at the same time on separate threads.** Never keep anything about the current request in a handler's `variables` scope:

```bxs
function show( event, rc, prc ) {
	variables.item = service.find( rc.id )   // WRONG: another request overwrites it
	prc.item = service.find( rc.id )         // right: prc belongs to this request
}
```

Per-request data goes in `rc`, `prc` or a `var`. Anything a handler holds on to (a service, a cache) must be safe to call from many threads. The route table and handler registry are built before `listen()` and never change afterwards.

## Actions

An action is any public function on a handler: `function name( event, rc, prc )`.

- **`rc`** is a new struct for each request holding `req.query`, then `req.body` (when a body parser produced a struct), then `req.params`. Later ones win, so a client can't override a route param. A key sent more than once is an array.
- **`prc`** is `res.locals`, so middleware can fill it before the action runs.
- **`event`** wraps the request and response:

| | |
|---|---|
| `getValue( name, defaultValue )`, `setValue( name, value )`, `valueExists( name )` | Read and write `rc`. A missing value with no default is `""`. |
| `getCollection()`, `getPrivateCollection()` | `rc` and `prc`. |
| `setView( view, layout )`, `setLayout( name )`, `noLayout()`, `noRender()` | Choose what is rendered. `noRender()` ends the response with no body. |
| `renderData( type, data, statusCode, contentType )` | Sends now. `type` is `json` (default), `html`, `text` or `xml`. JSON takes a plain struct or array; the others take a string. |
| `relocate( to, queryString, statusCode )` | Redirects. `to` is a URL (starts with `/` or has a scheme), a route name or a `handler.action`. |
| `buildLink( to, params )` | The URL of a route name or `handler.action`. `params` fill `:placeholders`; the rest become the query string. |
| `setHTTPHeader( name, value )`, `setStatusCode( code )` | |
| `getHTTPMethod()`, `getHTTPHeader( name, defaultValue )` | |
| `getCurrentEvent()`, `getCurrentHandler()`, `getCurrentAction()` | |
| `getRequest()`, `getResponse()` | The BoxExpress `req` and `res`, for anything not covered here. |

After the action, if nothing has been sent, the view is rendered: the one named with `setView()`, or `views/{handler}/{action}.bxm` (`views/admin/users/list.bxm` for `admin.users.list`).

`renderData()` and `relocate()` send the response immediately. Headers can't be changed after that, and a second response throws, as in BoxExpress.

A handler may also declare `preHandler( event, rc, prc, action )` and `postHandler( event, rc, prc, action )`. The order is `preHandler`, action, `postHandler`, view, layout. **If `preHandler` sends a response (a `relocate()` to the login page, say), the action and `postHandler` are skipped.**

An error thrown anywhere in that sequence goes to the app's error handler (`app.use( ( err, req, res, next ) => … )`).
