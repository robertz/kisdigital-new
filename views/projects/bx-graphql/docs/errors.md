# Errors

`errors` is always in the result: message strings by default, spec-shaped structs if you ask for them.

## Message strings

Without any setting, `errors` is an array of graphql-java's message strings, empty on success. An error on one field leaves the rest of the query's `data` in place.

## Structured errors

With `"structuredErrors" : true`, each error is a struct as the GraphQL spec has it:

```bxs
{
	"message"    : "None left",                  // the exception's own message
	"path"       : [ "saveWidget" ],
	"locations"  : [ { "line" : 1, "column" : 12 } ],
	"extensions" : { "type" : "Shop.OutOfStock", "classification" : "DataFetchingException" }
}
```

| Key | What it holds |
|---|---|
| `extensions.type` | The BoxLang exception type a resolver or service function threw. |
| `extensions.classification` | graphql-java's own: `ValidationError`, `InvalidSyntax`, `DataFetchingException` and so on. |

`path`, `locations` and `extensions` are left out when empty.

## Logging with onError

Whichever shape `errors` takes, `onError` is called once per error:

```bxs
"onError" : ( detail ) => {
	// detail: { message, rawMessage, path, locations, type, classification, exception }
}
```

`exception` is the one thrown, if any. This is the place to log what `errors` only summarizes.

## Types the module throws

| Type | When |
|---|---|
| `BxGraphQL.ConfigurationException` | At construction: a setting or a schema that can't work. |
| `BxGraphQL.NotAuthorized` | On a field: the [authorizer](/projects/bx-graphql/docs/authorization) refused it. |
| `BxGraphQL.NullArgument` | On a field: `null` was given for an argument whose [default is an expression](/projects/bx-graphql/docs/code-first#defaults-and-nulls). |
