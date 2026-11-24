# Routes

The routes class: `route()`, the method shortcuts, `group()`, `resources()`, `_method` and the convention route.

## The routes class

```bxs
class {
	function configure() {
		route( "/items/:id" ).as( "itemDetail" ).to( "items.show" )
		route( "/login" ).withAction( { GET: "form", POST: "doLogin" } ).toHandler( "auth" )
		route( "/about", "pages.about" )
		resources( "photos" )
		route( "/health", ( req, res ) => res.send( "ok" ) )

		get( "/search", "items.search" )
		post( "/items", "items.create" )
		route( "/about" ).toView( "pages/about" )
		route( "/home" ).toRedirect( "/" )

		group( { pattern: "/admin" }, () => {
			get( "/", "admin.dashboard.index" )
			resources( "users", "/users", "admin.users" )
		} )

		route( "/:handler/:action?" ).end()
	}
}
```

- `to( "handler.action" )` answers every HTTP method. Use `withAction()` to tie methods to actions; other methods then get a 404.
- `as( name )` names a route for `buildLink()` and `relocate()`.
- A function as the second argument is a plain BoxExpress handler.
- `get()`, `post()`, `put()`, `patch()` and `delete()` take `( path, target, name )` and answer that one method.
- `toView( view, layout )` renders a view on GET with no handler behind it. The view sees `rc`, `prc`, `flash` and an `event` with no handler or action.
- `toRedirect( target, statusCode )` redirects every method, with a 301 unless told otherwise.
- `group( { pattern: "/admin" }, () => { … } )` puts the pattern in front of every path declared inside it. Groups nest. `pattern` is the only option.
- A route pointing at a handler, action or view that doesn't exist throws at startup, as does a `route()` never finished with `to()`, `toHandler()`, `toView()`, `toRedirect()` or `end()`.

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

The handler needs all seven actions.

- `apiResources( "photos" )` leaves out `new` and `edit`, the two routes that only serve HTML forms.
- `resources( "comments", "/photos/:photoId/comments" )` nests: the second argument is the path to use in place of `/comments`, and `rc.photoId` arrives with every action. A third argument names the handler when it isn't the resource's name.

## _method

HTML forms can only send GET and POST. A POST whose body has a `_method` field of `PUT`, `PATCH` or `DELETE` is routed as that method:

```html
<form method="post" action="/photos/4">
	<input type="hidden" name="_method" value="DELETE">
	<button>Delete</button>
</form>
```

It needs a body parser (`boxExpressUrlencoded()`) in front of the router. Only a POST is upgraded, so a link or an image tag can't use it, and the CSRF check has already run. `_method` is left out of `rc`.

## The convention route

`route( "/:handler/:action?" ).end()` serves any action of any handler at `/handler/action`, with `index` as the default action. It is opt-in and always registered after every other route.

**It answers every HTTP method, so a GET can reach an action that changes data.** List those actions in [`this.allowedMethods`](/projects/boxlang-express-mvc/docs/handlers#thisallowedmethods), or leave this route out. Only actions are reachable; `init`, `preHandler`, `postHandler`, private functions and public functions without an `event` argument answer 404, as does an unknown handler or action (unless the handler has [`onMissingAction`](/projects/boxlang-express-mvc/docs/handlers#onmissingaction-and-oninvalidhttpmethod)). A nested handler is reached with its dotted name: `/admin.users/list`.
