# Testing

Testing an app without opening a port.

## app.inject()

Use BoxExpress's [`app.inject()`](/projects/boxlang-express/docs/testing); no port is needed:

```bxs
var res = app.inject( { method: "POST", url: "/items/new", form: { name: "Lamp" } } )
expect( res.statusCode ).toBe( 302 )
```

To run this module's own suite: `boxlang setup-tests.bxs` once (it expects a BoxExpress checkout at `../boxlang-express`, or pass its path), then `boxlang run-tests.bxs`.
