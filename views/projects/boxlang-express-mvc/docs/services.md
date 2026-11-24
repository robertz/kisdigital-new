# Services

Giving handlers their services, with a plain struct or WireBox.

## Wiring

Either way, handlers are wired once at startup.

```bxs
// A plain struct: properties named after a key are filled in.
svc = { itemService: new services.ItemService() }
mvc = boxExpressMvc( { handlers: …, services: svc } )

// handlers/items.bx
class {
	property name="itemService";
	function index( event, rc, prc ) { prc.items = itemService.list() }
}
```

```bxs
// WireBox (install it yourself: `box install wirebox`)
injector = new wirebox.system.ioc.Injector()
injector.getBinder().mapDirectory( packagePath = "models" )
mvc = boxExpressMvc( { handlers: …, injector: injector } )

// handlers/items.bx
class {
	property name="itemService" inject="ItemService";
}
```

Tested with WireBox 8.3, including in the `boxlang:cli` Docker image. It adds about a second and a half to startup.
