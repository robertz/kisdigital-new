# BoxLang Gotchas

Two BoxLang behaviors worth knowing before they cost you an afternoon.

## Reserved scope names

`server`, `application`, `session`, `request`, `url`, `form`, `cookie`, and `static` are reserved BoxLang scope names. Assigning a variable one of those names silently shadows the built-in scope instead of erroring at parse time, which produces confusing runtime errors.

BoxExpress's own code avoids all of them — `undertowServer` instead of `server`, `formData` instead of `form`, and the static-file middleware class is named `StaticFiles` rather than `Static`. Do the same in your app.

## res.json() only serializes plain structs

`JSONSerialize()` (and therefore `res.json()`) only serializes literal structs — not BoxLang class instances, even though `isStruct()` returns `true` for one and its properties are freely readable via dot access.

`req` is a `Request` instance, so `res.json( req )` silently returns `{}` rather than an error, no matter how many of `req.method`/`req.path`/`req.query` actually have values. `property` declarations and a `getMemento()` method don't change this. Build a plain struct out of the fields you want instead:

```bxs
res.json( { method: req.method, path: req.path, query: req.query, params: req.params, body: req.body } )
```

The same applies to `res`, or any other class instance — pass `res.json()` a struct, never an object.
