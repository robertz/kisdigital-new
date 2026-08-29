# HTTP Endpoint

The request/response shape of the standard POST endpoint the module registers.

## Request

`POST {basePath}` (default `/graphql`) accepts the standard GraphQL request body:

```json
{ "query": "...", "variables": {}, "operationName": null }
```

## Response

and returns the standard shape:

```json
{ "data": { ... }, "errors": [ { "message": "..." } ] }
```

Validation errors and resolver exceptions are captured by graphql-java itself into the `errors` array — they never surface as raw ColdBox exception pages. A malformed request body (not valid JSON, or missing `query`) returns HTTP 400 in the same shape.
