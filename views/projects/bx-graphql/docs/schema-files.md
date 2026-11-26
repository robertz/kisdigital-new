# Schema Files

Point `schemaPaths` at your `.graphqls` files; every one found is parsed and merged into a single schema.

## Paths

Each entry is a file, a directory or a wildcard:

```bxs
schemaPaths : [ expandPath( "/graphql/schema" ) ]              // every *.graphqls file in this directory
schemaPaths : [ expandPath( "/graphql/schema/*.graphqls" ) ]   // the same, as a wildcard
schemaPaths : [ expandPath( "/graphql/schema.graphqls" ) ]     // one file
```

Construction fails with `BxGraphQL.ConfigurationException` if `schemaPaths` is empty, or if any entry (one wildcard among several included) doesn't resolve to at least one file.

## Splitting a schema across files

A type used in one file and defined in another resolves whatever the file order, because all files are parsed and merged before validation.

Operations can be split too, with GraphQL's `extend` keyword:

```graphql
extend type Query {
	widget(id: ID!): Widget
}
```

That works in a file that doesn't define `Query` itself, which helps once a single `Query` or `Mutation` block gets long.

## Reading the schema back

| Method | Returns |
|---|---|
| `printSchema()` | The whole executable schema as SDL. |
| `getGeneratedSDL()` | Only the SDL generated from annotated classes. See [Code-First Schema](/projects/bx-graphql/docs/code-first). |
| `getSchema()` | The live `graphql.schema.GraphQLSchema`. |
| `getEngine()` | The live `graphql.GraphQL` engine. |

The last two are graphql-java objects, for anything graphql-java itself supports.
