# Handlers & Actions

Handler classes, the `event` object, `rc` and `prc`, the hooks around an action, and flash.

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

An action is a public function on a handler whose first argument is named `event`: `function name( event, rc, prc )`. Any other public function is a helper and can't be routed to, though `private` says so more clearly.

- **`rc`** is a new struct for each request holding `req.query`, then `req.body` (when a body parser produced a struct), then `req.params`. Later ones win, so a client can't override a route param. A key sent more than once is an array.
- **`prc`** is `res.locals`, so middleware can fill it before the action runs.
- **`event`** wraps the request and response:

| | |
|---|---|
| `getValue( name, defaultValue )`, `setValue( name, value )`, `valueExists( name )` | Read and write `rc`. A missing value with no default is `""`. |
| `getCollection()`, `getPrivateCollection()` | `rc` and `prc`. |
| `setView( view, layout )`, `setLayout( name )`, `noLayout()`, `noRender()` | Choose what is rendered. `noRender()` ends the response with no body. |
| `renderData( type, data, statusCode, contentType )` | Sends now. `type` is `json` (default), `html`, `text` or `xml`. JSON takes a plain struct or array; the others take a string. |
| `relocate( to, queryString, statusCode )` | Redirects. `to` is a path (starts with one `/`), a URL with a scheme, a route name or a `handler.action`. |
| `buildLink( to, params )` | The URL of a route name or `handler.action`. `params` fill `:placeholders`; the rest become the query string. |
| `setHTTPHeader( name, value )`, `setStatusCode( code )` | |
| `getHTTPMethod()`, `getHTTPHeader( name, defaultValue )` | |
| `paramValue( name, value )` | Sets a value in `rc` only if it isn't there. |
| `getOnly( keys )`, `getExcept( keys )` | Part of `rc` as a new struct. `getOnly( "title,body" )` is the safe way to hand form input to a model. |
| `populateModel( model, include, exclude )` | Copies `rc` into a struct, or into an object through its setters (`setTitle()` for `title`, generated accessors included). **Pass `include`** for anything a form posts, or a client can set any property. |
| `isAjax()` | `X-Requested-With: XMLHttpRequest` was sent. |
| `getHTTPContent( json )` | The request body as text, or parsed with `json = true`. |
| `getFlash()` | The [flash scope](#flash). |
| `announce( name, data, async )` | Calls [interceptors](/projects/boxlang-express-mvc/docs/interceptors). |
| `getCurrentEvent()`, `getCurrentHandler()`, `getCurrentAction()` | |
| `getRequest()`, `getResponse()` | The BoxExpress `req` and `res`, for anything not covered here. |

After the action, if nothing has been sent, the view is rendered: the one named with `setView()`, or `views/{handler}/{action}.bxm` (`views/admin/users/list.bxm` for `admin.users.list`).

`renderData()` and `relocate()` send the response immediately. Headers can't be changed after that, and a second response throws, as in BoxExpress.

A handler may also declare `preHandler( event, rc, prc, action )` and `postHandler( event, rc, prc, action )`. The order is `preHandler`, action, `postHandler`, view, layout. **If `preHandler` sends a response (a `relocate()` to the login page, say), the action and `postHandler` are skipped.**

An error thrown anywhere in that sequence goes to the app's error handler (`app.use( ( err, req, res, next ) => … )`).

## Limiting and wrapping the hooks

```bxs
class {

	this.prehandler_only = "edit,update,delete"
	this.posthandler_except = "index"

	function preHandler( event, rc, prc, action ) { prc.item = itemService.get( rc.id ) }

}
```

`prehandler_only`, `prehandler_except`, `posthandler_only`, `posthandler_except`, `aroundhandler_only` and `aroundhandler_except` take a list or an array of action names. A name that isn't an action throws at startup.

`aroundHandler` replaces the direct call to the action, so it can do something on both sides of it:

```bxs
function aroundHandler( event, targetAction, eventArguments, rc, prc ) {
	transaction {
		targetAction( argumentCollection = eventArguments )
	}
}
```

`targetAction` takes `( event, rc, prc )`. If `aroundHandler` doesn't call it, the action doesn't run. `preHandler` still runs before and `postHandler` after.

`aroundHandler`, `onMissingAction` and `onInvalidHTTPMethod` are reserved names and can't be actions.

## Flash

Flash holds values for one redirect: put a message, relocate, read it on the next page. It lives in the BoxExpress session, so it needs `app.use( boxExpressSession() )` in front of the router.

```bxs
function create( event, rc, prc ) {
	itemService.add( rc.name )
	event.getFlash().put( "notice", "Item added." )
	event.relocate( "items.index" )
}
```

```html
<bx:if flash.exists( "notice" )><p>#encodeForHTML( flash.get( "notice" ) )#</p></bx:if>
```

`flash` is a variable in every view and layout, and `event.getFlash()` elsewhere. It has `put( name, value )`, `get( name, defaultValue )`, `exists( name )`, `getAll()`, `keep( names )`, `remove( name )` and `clear()`.

A value is readable in the request that put it and in the next request that reads flash, then it is gone; `keep()` carries it one request further. A request that never touches flash (an asset, an API call) doesn't use it up. Without a session, reading gives the default and `put()` throws.

Handlers are shared between requests, so there is no `flash` variable inside a handler as there is in ColdBox; get it from the event.

## this.allowedMethods

```bxs
class {

	this.allowedMethods = { delete: "POST,DELETE", save: "POST" }

	function delete( event, rc, prc ) { … }

}
```

A request for a listed action with any other method gets a `405` and an `Allow` header, whichever route it came in on. `HEAD` counts as `GET`. An action that isn't listed answers every method. A name that isn't an action, or a method that doesn't exist, throws at startup.

**List every action that changes data.** `route().to()` and the convention route answer every method, and `boxExpressCsrf()` does not check a `GET`, so without this a link or an image tag on another site can run the action for a signed-in visitor.

## onMissingAction and onInvalidHTTPMethod

`onMissingAction( event, rc, prc, missingAction, eventArguments )` runs when the [convention route](/projects/boxlang-express-mvc/docs/routes#the-convention-route) finds the handler but not the action. The action name came from the URL, so nothing is rendered by convention: send a response or call `setView()`, or the request goes on to the app's 404.

`onInvalidHTTPMethod( event, rc, prc, faultAction, eventArguments )` runs when `this.allowedMethods` refuses a request. The status is already 405 and the `Allow` header is set; if the function sends nothing, the plain "Method Not Allowed" body goes out.

## Redirecting to something a visitor sent

`relocate()` refuses `//host` and `/\host`, which look like paths but send a browser to another site. It does follow a full URL, so a value such as `rc.returnTo` still needs checking before it is passed in: accept it only if it starts with a single `/`.
