# Request

The `req.*` API available inside every handler.

## The request object

| Property / Method | Description |
|---|---|
| `req.method` | Uppercased HTTP method, e.g. `"GET"` |
| `req.path` | Path portion of the URL, no query string |
| `req.originalUrl` | Path plus query string as received |
| `req.query` | Struct of parsed query-string parameters; a repeated key is an array — see [Query strings](#query-strings) |
| `req.params` | Struct of captured route params (`:id` segments) |
| `req.body` | Parsed request body — a struct from `boxExpressJSON()`/`boxExpressUrlencoded()`/`boxExpressUpload()`, a string from `boxExpressText()`, a `byte[]` from `boxExpressRaw()`, empty struct otherwise |
| `req.valid` | The fields a `boxExpressValidate()` schema names, converted — see [Request Validation](/projects/boxlang-express/docs/validation) |
| `req.files` | Uploaded files, populated by `boxExpressUpload()` |
| `req.headers` | Struct of request headers |
| `req.get(name)` | Read a single header by name — returns null if absent |
| `req.cookies` | Struct of parsed cookies |
| `req.signedCookies` | Cookies set with `{ signed: true }` that passed verification (`false` for one that didn't) — see [Signed cookies](/projects/boxlang-express/docs/response#signed-cookies) |
| `req.ip` | Direct TCP peer address by default; prefers an edge-set header named via `"trust proxy header"`, else the `X-Forwarded-For` entry `"trust proxy"` selects — see [Configuration](/projects/boxlang-express/docs/config) |
| `req.protocol` / `req.secure` | Always `"http"` / `false` — BoxExpress's own `HttpServer` never terminates TLS — unless the directly connected peer is a trusted proxy and the request carries `X-Forwarded-Proto: https` |
| `req.hostname` | The `Host` header (or `X-Forwarded-Host`, from a trusted proxy) with any `:port` stripped |
| `req.subdomains` / `req.xhr` / `req.baseUrl` | See [More request properties](#more-request-properties) |
| `req.accepts(...)` / `req.acceptsLanguages(...)` / `req.is(...)` | See [Content negotiation](#content-negotiation) |
| `req.fresh` / `req.stale` | Whether the client's cached copy still matches the response's `ETag` or `Last-Modified` — see [ETags and conditional requests](/projects/boxlang-express/docs/response#etags-and-conditional-requests) |
| `req.setTimeout(ms)` / `req.timedOut` | One request's own timeout, and whether it hit it — see [Timeouts & Size Limits](/projects/boxlang-express/docs/limits) |
| `req.id` | The request's id when `app.set("requestId", true)` is on — see [Observability](/projects/boxlang-express/docs/observability) |
| `req.session` / `req.sessionID` | Populated by `boxExpressSession()` — see [Sessions](/projects/boxlang-express/docs/sessions) |
| `req.rawExchange()` | Escape hatch to the underlying `io.undertow.server.HttpServerExchange` |

`req.body` is populated by body-parsing middleware and `req.files` by the upload middleware — see [Middleware](/projects/boxlang-express/docs/middleware) and [File Uploads](/projects/boxlang-express/docs/uploads).

Cookie and query values are URL-decoded. One with a malformed escape (`discount=50%`, `%zz`) is kept as its raw text rather than failing the request — a cookie can be set by any script or sibling subdomain, so a bad one shouldn't lock a visitor out. (Before 0.2.26 it failed every request carrying it with a `500`.)

## Query strings

`req.query` follows Express 5's default ("simple") parser, the semantics of Node's `querystring` module:

| Request | `req.query` |
|---|---|
| `?tag=a` | `{ tag: "a" }` |
| `?tag=a&tag=b` | `{ tag: [ "a", "b" ] }` |
| `?tag=&flag` | `{ tag: "", flag: "" }` |
| `?tag[]=a&tag[]=b` | `{ "tag[]": [ "a", "b" ] }` |
| `?user[name]=Ada` | `{ "user[name]": "Ada" }` |

A key that appears once is a string; a key that repeats is an array, in the order the values appeared. Brackets are not parsed — there is no nested (`a[b]=1`) or `a[]=1` syntax, which was Express 4's "extended" mode — so those keys stay literal. `boxExpressUrlencoded()` and `boxExpressUpload()` parse form fields the same way.

> [!WARNING] Breaking change in 0.2.28
> Before 0.2.28 the last value of a repeated key silently replaced the others. **Any client can repeat a key**, so a value you expect to be a string can now arrive as an array, and string code (`len()`, `&`, `trim()`) then throws.

Declare what you expect with [`boxExpressValidate()`](/projects/boxlang-express/docs/validation) — a `string` or `integer` field answers `400` for an array, and an `array` field accepts one value or several — or normalise by hand:

```bxs
var tags = req.query.tag ?: []
if ( !isArray( tags ) ) {
	tags = [ tags ]
}
```

A query string may hold at most 1000 `key=value` pairs — a repeated key counts once per appearance. One with more is answered with a `400` (`{ error: true, message: "Query string has more than 1000 parameters" }`) before any middleware or handler runs, rather than being cut short and handled as if the rest weren't there. Change the limit with `app.set( "parameterLimit", n )`; `0` turns it off. See [Timeouts & Size Limits](/projects/boxlang-express/docs/limits#parameter-count).

One difference from Express: a BoxLang struct's keys are case-insensitive, so `?Tag=a&tag=b` is one key, `{ Tag: [ "a", "b" ] }`, where Express would give two.

## req.ip behind a proxy

`req.ip` is always the direct TCP peer by default — safe, since a client can't spoof it, but wrong behind a reverse proxy (it reports the proxy's IP). `app.set( "trust proxy", ... )` says which proxies to believe, with the same meanings as Express: `false` (the default), a hop count, a list of proxy addresses, or `true`. On platforms where `X-Forwarded-For` can be forged, `"trust proxy header"` reads an edge-set header instead. Both are covered in full under [Configuration](/projects/boxlang-express/docs/config#app-level-settings).

## req.protocol, req.secure and req.hostname

These follow the same trust model. BoxExpress's own `HttpServer` never terminates TLS itself, so `req.protocol` is always `"http"` (and `req.secure` always `false`) unless the directly connected peer is a trusted proxy _and_ the request carries `X-Forwarded-Proto: https` — the shape you'd see behind a TLS-terminating reverse proxy.

`req.hostname` is the `Host` header (or, from a trusted proxy, `X-Forwarded-Host` if present) with any `:port` suffix stripped. An IPv6 host (`[::1]:3000`) is left bracketed rather than mangled at the first colon.

## Content negotiation

`req.accepts( types )` returns whichever of the types you offer the request's `Accept` header prefers, or `false` if it accepts none of them. Offer extensions or full MIME types, as separate arguments or one array; you get back the same string you passed:

```bxs
app.get( "/report", ( req, res ) => {
	switch ( req.accepts( "html", "json", "csv" ) ) {
		case "json": return res.json( report )
		case "csv": return res.attachment( "report.csv" ).send( toCsv( report ) )
		case "html": return res.render( "report", report )
		default: return res.sendStatus( 406 )
	}
} )
```

The client's `q` weights decide, then how specific its range is (`text/html` over `text/*` over `*/*`), then the order you offered them in. A request with no `Accept` header accepts anything, so it gets your first offer. Called with no arguments, `req.accepts()` returns the types the client listed, most preferred first. For the common "one handler per type" case, [`res.format()`](/projects/boxlang-express/docs/response#resformat) does the switch for you.

`req.acceptsLanguages( "fr", "en" )` is the same against `Accept-Language`. `en` satisfies a client asking for `en-US`, and `en-GB` satisfies one asking for `en`; an exact tag wins over either.

`req.is( types )` checks the request's own `Content-Type` — what the client *sent*, not what it wants back:

```bxs
app.post( "/hook", ( req, res ) => {
	if ( !req.is( "json", "+json" ) ) {
		return res.sendStatus( 415 )
	}
	...
} )
```

It returns the first type that matches, or `false`. A type can be an extension (`"json"`), a full type, a wildcard (`"text/*"`, `"*/xml"`), a suffix (`"+json"`, matching `application/vnd.api+json`), or the shorthands `"urlencoded"` and `"multipart"`. A wildcard or suffix match returns the actual type. A request with no `Content-Type` is always `false` — Express returns `null` for a request with no body; here it's `false` either way.

Two limits: media-type parameters other than `q` are ignored (`text/html;level=1` is treated as `text/html`), and there's no `req.acceptsEncodings()`/`req.acceptsCharsets()`, since BoxExpress doesn't compress or transcode responses.

## More request properties

- `req.xhr` — `true` when `X-Requested-With` is `XMLHttpRequest`, which jQuery and axios send and `fetch()` doesn't.
- `req.subdomains` — the labels in front of the domain, nearest the domain first: `tobi.ferrets.example.com` gives `[ "ferrets", "tobi" ]`. The last two labels are taken to be the domain; for `example.co.uk` set `app.set( "subdomain offset", 3 )`. Empty for an IP address. It's built from `req.hostname`, so it follows `trust proxy` the same way.
- `req.baseUrl` — the path the current router or path-scoped middleware is mounted at, `""` at the top level. Inside a router mounted with `app.use( "/api", apiRouter )`, a request for `/api/users/42` has `req.baseUrl` `"/api"`, `req.path` `"/users/42"` and `req.originalUrl` `"/api/users/42"`. Nested mounts add up (`/api/v2`), and a param in the mount path shows its value, not `:name`. Use it to build links that keep working wherever the router is mounted:

  ```bxs
  apiRouter.post( "/users", ( req, res ) => {
  	var user = users.create( req.body )
  	res.status( 201 ).location( req.baseUrl & "/users/" & user.id ).json( user )
  } )
  ```
- `req.fresh` / `req.stale` — whether the client's cached copy still matches the `ETag` or `Last-Modified` set on the response so far; `req.stale` is the opposite. See [ETags and conditional requests](/projects/boxlang-express/docs/response#etags-and-conditional-requests).

## Reading the request

```bxs
app.get( "/whoami", ( req, res ) => {
    res.json( { ip: req.ip, userAgent: req.get( "User-Agent" ) } )
} )
```

`req` is a class instance, not a plain struct, so `res.json( req )` returns `{}` — build a struct out of the fields you want instead. See [BoxLang Gotchas](/projects/boxlang-express/docs/gotchas).
