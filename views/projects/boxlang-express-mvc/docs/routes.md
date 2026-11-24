# Routes

The routes class: `route()`, `resources()` and the convention route.

## The routes class

```bxs
class {
	function configure() {
		route( "/items/:id" ).as( "itemDetail" ).to( "items.show" )
		route( "/login" ).withAction( { GET: "form", POST: "doLogin" } ).toHandler( "auth" )
		route( "/about", "pages.about" )
		resources( "photos" )
		route( "/health", ( req, res ) => res.send( "ok" ) )
		route( "/:handler/:action?" ).end()
	}
}
```

- `to( "handler.action" )` answers every HTTP method. Use `withAction()` to tie methods to actions; other methods then get a 404.
- `as( name )` names a route for `buildLink()` and `relocate()`.
- A function as the second argument is a plain BoxExpress handler.
- A route pointing at a handler or action that doesn't exist throws at startup, as does a `route()` never finished with `to()`, `toHandler()` or `end()`.

Paths are BoxExpress paths: `:name`, a trailing `:name?`, a trailing `*` or `*name`, and constraints such as `:id(\d+)`. An optional or wildcard segment anywhere but the end can't be matched and throws at startup, naming the route. The first matching route wins, so put specific routes above general ones.

## resources( "photos" )

| Method | Path | Action |
|---|---|---|
| GET | `/photos` | `index` |
| GET | `/photos/new` | `new` |
| POST | `/photos` | `create` |
| GET | `/photos/:id` | `show` |
| GET | `/photos/:id/edit` | `edit` |
| PUT, PATCH | `/photos/:id` | `update` |
| DELETE | `/photos/:id` | `delete` |

The handler needs all seven actions. HTML forms can only send GET and POST, and there is no `_method` override; put a small middleware in front if you need one:

```bxs
app.use( ( req, res, next ) => {
	var override = req.body._method ?: ""
	if ( req.method == "POST" && isSimpleValue( override ) && listFindNoCase( "PUT,PATCH,DELETE", override ) ) {
		req.method = uCase( override )
	}
	next()
} )
```

## The convention route

`route( "/:handler/:action?" ).end()` serves any action of any handler at `/handler/action`, with `index` as the default action. It is opt-in and always registered after every other route.

**It answers every HTTP method, so a GET can reach an action that changes data.** Leave it out, or keep state-changing actions on explicit routes, unless every such action checks the method itself. Only public actions are reachable; `init`, `preHandler`, `postHandler` and private functions answer 404, as does an unknown handler or action. A nested handler is reached with its dotted name: `/admin.users/list`.
