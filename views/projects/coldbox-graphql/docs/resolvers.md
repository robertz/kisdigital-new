# Resolvers

The convention that wires a WireBox mapping to a schema type, and the four arguments every resolver method gets.

## The convention

For a schema type `TypeName` with field `fieldName`, the module looks for a WireBox mapping at `{resolverBasePackage}.{TypeName}Resolver` and, if it exists and implements a `fieldName()` method, calls it. Otherwise it falls back to graphql-java's `PropertyDataFetcher` — reading a same-named key off the parent object. This means **you only write a resolver for fields that need custom logic**; a struct with matching keys just works.

## Resolver method signature

Resolver methods receive four named arguments:

```cfscript
any function fieldName( any source, struct args, any context, any env ){
    // source  — the parent object (struct/whatever the parent resolver returned).
    //           NULL for root Query/Mutation fields — don't mark it `required`.
    // args    — the field's GraphQL arguments, as an ordinary CFML struct/array
    //           (already converted from graphql-java's raw Map — case-insensitive
    //           dot access works as normal).
    // context — the ColdBox `event` (RequestContext) for the current request, so you can
    //           reach rc/prc, headers, session, etc. via the normal ColdBox API.
    // env     — the raw graphql.schema.DataFetchingEnvironment, for advanced use.
}
```

## Example

`schema.graphqls`:

```graphql
type Query {
    widget(id: ID!): Widget
}

type Widget {
    id: ID!
    name: String
    slug: String
}
```

`models/resolvers/QueryResolver.cfc`:

```cfscript
component {
    property name="widgetService" inject="WidgetService";

    any function widget( any source, required struct args, any context, any env ){
        return widgetService.get( args.id ); // returns a struct with id/name/slug
    }
}
```

No `WidgetResolver.cfc` is needed at all — `id`, `name`, and `slug` all resolve via `PropertyDataFetcher` off the struct `widget()` returned. If you later need `slug` computed rather than stored, add `models/resolvers/WidgetResolver.cfc` with just a `slug()` method; `id` and `name` keep resolving automatically.

## Mutations

`Mutation` gets no special treatment — it's just another object type name to the wiring loop in `GraphQLService.wireResolvers()`, so it follows the exact same `{resolverBasePackage}.{TypeName}Resolver` convention as `Query`, with the exact same four named arguments.

Extending the schema above with a mutation:

```graphql
type Mutation {
    createWidget(name: String!): Widget!
    deleteWidget(id: ID!): Boolean!
}
```

`models/resolvers/MutationResolver.cfc`:

```cfscript
component {
    property name="widgetService" inject="WidgetService";

    any function createWidget( any source, required struct args, any context, any env ){
        return widgetService.create( args.name ); // returns a struct with id/name/slug
    }

    boolean function deleteWidget( any source, required struct args, any context, any env ){
        return widgetService.delete( args.id );
    }
}
```

The result of `createWidget` flows back through the schema exactly like a query result does — since it returns a struct shaped like `Widget`, the `id`/`name`/`slug` fields on the response resolve via the same `PropertyDataFetcher` fallback, no extra wiring needed.

One thing the module does _not_ do anything special for: per the GraphQL spec, top-level mutation fields in a single request execute serially, in the order they appear in the query, rather than in parallel like top-level query fields. That's handled entirely by graphql-java's own execution strategy once it sees a `Mutation` root type — nothing to configure here.

> [!WARNING] Not implemented in this version
> Interface/union `TypeResolver` wiring — every object type gets its own convention-based resolver, but resolving _which_ concrete type implements an interface/union at runtime is not wired up.
