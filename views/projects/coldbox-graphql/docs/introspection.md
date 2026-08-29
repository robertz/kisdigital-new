# Introspection & SDL

GraphQL's own introspection queries, versus getting the schema itself back out as CFML.

## Standard introspection

With `enableIntrospection` left on (the default), the standard `__schema`/`__type` queries are answered over `POST {basePath}` like any other GraphQL server — this is what tools like GraphiQL or Apollo use to discover a schema at query time. Set it `false` in production if you don't want that exposed.

## Exposing the schema programmatically

`GraphQLService.getSchema()` returns the raw `graphql.schema.GraphQLSchema` object the module built from your `.graphqls` files — inject `GraphQLService@coldbox-graphql` anywhere and call it:

```cfscript
property name="graphQLService" inject="GraphQLService@coldbox-graphql";

var schema = graphQLService.getSchema();
```

That's a live graphql-java object, useful for anything graphql-java itself supports — most commonly, printing it back out as SDL text via `graphql.schema.idl.SchemaPrinter`, e.g. for docs, `graphql-codegen`-style client tooling, or a `GET /schema` endpoint. Build it via `JavaClassFactory@coldbox-graphql`, same as everywhere else in the module:

```cfscript
component {
    property name="javaClass"      inject="JavaClassFactory@coldbox-graphql";
    property name="graphQLService" inject="GraphQLService@coldbox-graphql";

    function execute( event, rc, prc ){
        // Options suppress graphql-java's built-in directives (@skip, @include, etc.)
        // and the `schema { query: Query }` block — left in, they're valid SDL but
        // noisy for anything meant to be read or fed to codegen.
        var options = javaClass.create( "graphql.schema.idl.SchemaPrinter$Options" )
            .defaultOptions()
            .includeDirectiveDefinitions( false )
            .includeSchemaDefinition( false );

        var printer = javaClass.create( "graphql.schema.idl.SchemaPrinter" ).init( options );
        var sdl = printer.print( graphQLService.getSchema() );

        event.renderData( type = "text", data = sdl );
    }
}
```

This is separate from GraphQL's own introspection above — introspection answers questions about the schema at query time over the wire; `getSchema()`/`SchemaPrinter` give you the schema itself, in CFML, for anything that needs the actual `.graphqls` text or the schema object directly.
