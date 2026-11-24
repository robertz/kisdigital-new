# Getting Started

Install the module, lay out an app, and serve your first handler.

## Requirements

- BoxLang 1.15+ and [boxlang-express](/projects/boxlang-express) 0.2.27+. The test suite runs on BoxLang 1.15 through 1.19 and in the `boxlang:cli` Docker image.
- It is **familiar, not compatible**: existing ColdBox apps, ColdBox modules and CBWIRE do not run on it. Coming from ColdBox? Read [Coming from ColdBox](/projects/boxlang-express-mvc/docs/coming-from-coldbox) first.

## Install

```bash
install-bx-module boxlang-express boxlang-express-mvc bx-esapi --local
```

`bx-esapi` supplies the `encodeFor…()` functions views need to escape output — see [Views & Layouts](/projects/boxlang-express-mvc/docs/views).

## Quick start

```
myapp/
  server.bxs
  boxlang_modules/        boxexpress, boxexpressmvc and bx-esapi
  config/Router.bx
  handlers/items.bx
  views/items/index.bxm
  layouts/Main.bxm
```

```bxs
// server.bxs — run with `boxlang server.bxs` from this directory
app = boxExpress()
app.use( boxExpressUrlencoded() )

mvc = boxExpressMvc( {
	handlers: expandPath( "./handlers" ),
	views: expandPath( "./views" ),
	layouts: expandPath( "./layouts" ),
	routes: expandPath( "./config/Router.bx" )
} )
app.use( mvc.router() )

app.use( ( err, req, res, next ) => res.status( 500 ).send( "Something went wrong." ) )
app.listen( 3000 )
```

```bxs
// config/Router.bx
class {
	function configure() {
		route( "/", "items.index" )
		route( "/items/:id(\d+)" ).as( "itemDetail" ).to( "items.show" )
	}
}
```

```bxs
// handlers/items.bx
class {
	function index( event, rc, prc ) {
		prc.items = [ { id: 1, name: "Anvil" } ]
		// renders views/items/index.bxm inside layouts/Main.bxm
	}

	function show( event, rc, prc ) {
		event.renderData( type = "json", data = { id: rc.id } )
	}
}
```

```html
<!-- views/items/index.bxm -->
<bx:output>
<bx:loop array="#prc.items#" item="item">
	<a href="#event.buildLink( "itemDetail", { id: item.id } )#">#encodeForHTML( item.name )#</a>
</bx:loop>
</bx:output>
```

```html
<!-- layouts/Main.bxm -->
<bx:output>
<html><body>#view()#</body></html>
</bx:output>
```

Two complete apps are in [examples/](https://github.com/robertz/boxlang-express-mvc/tree/main/examples): `starter`, a rebuild of the ColdBox starter template, and `todo`, a todo list with forms, a service, a partial, sessions with CSRF protection, and a Dockerfile.

Everything here compiles to plain BoxExpress routes when the app starts. Nothing is scanned or looked up on disk per request.

## Settings

| Key | |
|---|---|
| `handlers` | Required. Directory of handler classes. `handlers/admin/users.bx` is the handler `admin.users`. |
| `views` | Directory of `.bxm` views. Without it an action has to send its own response. |
| `layouts` | Directory of `.bxm` layouts. |
| `defaultLayout` | Layout name. Defaults to `Main` when `layouts/Main.bxm` exists, otherwise no layout. |
| `routes` | Path of a routes class (below). Routes can also be added in code with `mvc.route()` and `mvc.resources()`. |
| `services` | A struct. A handler property named after one of its keys is set to that value at startup. |
| `injector` | A WireBox injector. `injector.autowire()` is called on each handler at startup. |

`mvc.getHandlers()` returns each handler's name with its action names, for a listing page or a startup log.

`mvc.router()` returns an ordinary BoxExpress router, so it mounts anywhere (`app.use( "/admin", mvc.router() )`) and middleware goes in front of it the usual way. Calling it ends route registration; a route added later throws.
