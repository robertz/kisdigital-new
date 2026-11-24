# Views & Layouts

`.bxm` views, layouts, partials and escaping.

## Views and layouts

Views and layouts are `.bxm` files. Each sees `rc`, `prc` and `event`. `#…#` is only evaluated inside `<bx:output>`.

**Output is not escaped.** Wrap anything that came from a user in the encoder for where it lands:

```html
<bx:output>
<h1>#encodeForHTML( prc.item.name )#</h1>
<input name="name" value="#encodeForHTMLAttribute( prc.item.name )#">
</bx:output>
```

Install [`bx-esapi`](https://forgebox.io/view/bx-esapi) in every app:

```bash
install-bx-module boxlang-express boxlang-express-mvc bx-esapi --local
```

Only `encodeForHTML()` is part of BoxLang itself. `encodeForHTMLAttribute()`, `encodeForURL()`, `encodeForJavaScript()` and the rest come from `bx-esapi`, and a view that calls one without the module fails with "Function not found".

In a layout, `#view()#` is the rendered view. Anywhere, `#view( "partials/nav", { active: "items" } )#` renders another view inline; that view reads what it was passed as `args.active`.

The view runs before the layout, so a view can set `prc.title` for the layout to use.

These views are separate from BoxExpress's own `res.render()`: `app.set( "views" )`, `app.set( "view layout" )` and `partial()` don't apply here, and `res.render()` still works in plain-function routes.

Edits to `.bxm` files show up without a restart. Handlers and the routes file are loaded once; restart, or use BoxExpress's `app.set( "reloadOnChange", true )`, which restarts the server when a handler, model or the routes file changes.
