# Testing

`app.inject( options )` runs one request through the app — routing, middleware, handlers, error handling — on the calling thread, without opening a port, and returns what the app produced:

```bxs
var res = app.inject( { method: "POST", url: "/users", body: { name: "ada" } } )
expect( res.statusCode ).toBe( 201 )
expect( res.json().name ).toBe( "ada" )
```

A bare string is a `GET`: `app.inject( "/health/ready" )`.

## Options

| Option | Effect |
|---|---|
| `method` | HTTP method (default `"GET"`) |
| `url` | Path plus optional query string. Encoded characters in the path are decoded, as for a real request |
| `query` | A struct merged into the query string, URL-encoded. An array value repeats the key |
| `headers` | Request headers |
| `body` | A struct or array is sent as JSON with the matching `Content-Type`; a string or binary value is sent as-is |
| `form` | A struct, sent urlencoded |
| `cookies` | A struct, sent as the `Cookie` header |
| `ip` | What `req.ip` sees (default `127.0.0.1`) |
| `log` | Print the usual request log line (off by default) |

## The result

| Member | Description |
|---|---|
| `statusCode` | The response status |
| `body` | The response body, as a string |
| `headers` | A struct of response headers with lower-cased names |
| `json()` | The body parsed as JSON |
| `header( name )` | One response header, case-insensitive — `""` if absent |
| `cookies` | The cookies the response set, name to value |
| `setCookies` | Each raw `Set-Cookie` line |

A response's `cookies` is shaped to be passed straight back in as the next call's `cookies`, which carries a session across calls:

```bxs
var login = app.inject( { method: "POST", url: "/login", form: { user: "ada" } } )
var me    = app.inject( { url: "/me", cookies: login.cookies } )
```

## What behaves like a real request

The request goes through the same `Request`/`Response` objects, router and error handling as one arriving over a socket. A `404`, a thrown handler becoming a `500`, an oversized body becoming a `413`, and a response header refused for containing a newline (see [Request & Response](/projects/boxlang-express/docs/request-response)) all behave the same.

## What it can't do

- `req.rawExchange()` is `null` — there is no Undertow behind an injected request.
- `app.ws()` routes can't be reached this way. Those need a real server and a WebSocket client.
