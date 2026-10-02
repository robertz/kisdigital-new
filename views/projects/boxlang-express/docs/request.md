# Request

The `req.*` API available inside every handler.

## The request object

| Property / Method | Description |
|---|---|
| `req.method` | Uppercased HTTP method, e.g. `"GET"` |
| `req.path` | Path portion of the URL, no query string |
| `req.originalUrl` | Path plus query string as received |
| `req.query` | Struct of parsed query-string parameters |
| `req.params` | Struct of captured route params (`:id` segments) |
| `req.body` | Parsed request body — populated by `boxExpressJSON()`/`boxExpressUrlencoded()`/`boxExpressUpload()`, empty struct otherwise |
| `req.files` | Uploaded files, populated by `boxExpressUpload()` |
| `req.headers` | Struct of request headers |
| `req.get(name)` | Read a single header by name — returns null if absent |
| `req.cookies` | Struct of parsed cookies |
| `req.ip` | Direct TCP peer address by default; prefers an edge-set header named via `"trust proxy header"`, else the `X-Forwarded-For` entry `"trust proxy"` selects — see [Configuration](/projects/boxlang-express/docs/config) |
| `req.protocol` / `req.secure` | Always `"http"` / `false` — BoxExpress's own `HttpServer` never terminates TLS — unless the directly connected peer is a trusted proxy and the request carries `X-Forwarded-Proto: https` |
| `req.hostname` | The `Host` header (or `X-Forwarded-Host`, from a trusted proxy) with any `:port` stripped |
| `req.id` | The request's id when `app.set("requestId", true)` is on — see [Observability](/projects/boxlang-express/docs/observability) |
| `req.session` / `req.sessionID` | Populated by `boxExpressSession()` — see [Sessions](/projects/boxlang-express/docs/sessions) |
| `req.rawExchange()` | Escape hatch to the underlying `io.undertow.server.HttpServerExchange` |

`req.body` is populated by body-parsing middleware and `req.files` by the upload middleware — see [Middleware](/projects/boxlang-express/docs/middleware) and [File Uploads](/projects/boxlang-express/docs/uploads).

## req.ip behind a proxy

`req.ip` is always the direct TCP peer by default — safe, since a client can't spoof it, but wrong behind a reverse proxy (it reports the proxy's IP). `app.set( "trust proxy", ... )` says which proxies to believe, with the same meanings as Express: `false` (the default), a hop count, a list of proxy addresses, or `true`. On platforms where `X-Forwarded-For` can be forged, `"trust proxy header"` reads an edge-set header instead. Both are covered in full under [Configuration](/projects/boxlang-express/docs/config#app-level-settings).

## req.protocol, req.secure and req.hostname

These follow the same trust model. BoxExpress's own `HttpServer` never terminates TLS itself, so `req.protocol` is always `"http"` (and `req.secure` always `false`) unless the directly connected peer is a trusted proxy _and_ the request carries `X-Forwarded-Proto: https` — the shape you'd see behind a TLS-terminating reverse proxy.

`req.hostname` is the `Host` header (or, from a trusted proxy, `X-Forwarded-Host` if present) with any `:port` suffix stripped. An IPv6 host (`[::1]:3000`) is left bracketed rather than mangled at the first colon.

## Reading the request

```bxs
app.get( "/whoami", ( req, res ) => {
    res.json( { ip: req.ip, userAgent: req.get( "User-Agent" ) } )
} )
```

`req` is a class instance, not a plain struct, so `res.json( req )` returns `{}` — build a struct out of the fields you want instead. See [BoxLang Gotchas](/projects/boxlang-express/docs/gotchas).
