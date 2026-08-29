# Schema Files

Where your .graphqls files live, how they're discovered, and splitting a schema across several.

## Adding your schema

Create a `graphql/schema/` directory at your app root and put your `.graphqls` files there:

```
myapp/
├── config/
├── graphql/
│   └── schema/
│       ├── schema.graphqls
│       └── widgets.graphqls
├── handlers/
├── models/
└── ...
```

Point `schemaPaths` at the directory — every `*.graphqls` file in it is parsed and merged into one schema automatically (see `resolveSchemaFiles()` in `models/GraphQLService.cfc`):

```cfscript
moduleSettings = {
    "coldbox-graphql" = {
        schemaPaths : [ "/graphql/schema" ]
    }
};
```

## Example: splitting a schema across files

`graphql/schema/schema.graphqls` — operations:

```graphql
type Query {
    widget(id: ID!): Widget
    widgets: [Widget!]!
}

type Mutation {
    createWidget(name: String!): Widget!
}
```

`graphql/schema/widgets.graphqls` — the domain type it refers to:

```graphql
type Widget {
    id: ID!
    name: String!
    slug: String
}
```

Both files get parsed and merged before validation, so forward references across files (`Widget` used in `schema.graphqls`, defined in `widgets.graphqls`) resolve fine regardless of file order.

You can also split operations themselves across files with GraphQL's `extend` keyword — e.g. a `widgets.graphqls` that starts with `extend type Query { widget(id: ID!): Widget }` instead of defining `Query` directly — useful once you have enough domains that a single growing `Query`/`Mutation` block gets unwieldy.

A single `schemaPaths` entry can also point directly at one file, or a wildcard like `/graphql/schema/*.graphqls`, if you'd rather be explicit than glob a whole directory.
