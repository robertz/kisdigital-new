# Custom Scalars

The module ships no custom scalars — bring your own via a customScalarProvider.

## Wiring one up

Point `customScalarProvider` at a WireBox mapping for a CFC implementing `getScalars()`, returning an array of already-built `graphql.schema.GraphQLScalarType` instances. Build them via the module's own `JavaClassFactory@coldbox-graphql` — not raw `createObject()` — so your scalar resolves graphql-java classes through the exact same classloader as everything else in the module (mixing classloaders throws a "No matching Method/Function" error where they interact — see [Getting Started](/projects/coldbox-graphql/docs/getting-started)):

```cfscript
// models/MyScalarProvider.cfc
// moduleSettings["coldbox-graphql"].customScalarProvider = "models.MyScalarProvider"
component {
    property name="javaClass" inject="JavaClassFactory@coldbox-graphql";

    array function getScalars(){
        var coercing = createDynamicProxy( new DateTimeCoercing(), "graphql.schema.Coercing" );
        var scalar = javaClass.create( "graphql.schema.GraphQLScalarType" )
            .newScalar()
            .name( "DateTime" )
            .description( "ISO-8601 date-time" )
            .coercing( coercing )
            .build();
        return [ scalar ];
    }
}
```

`DateTimeCoercing.cfc` implements `graphql.schema.Coercing`'s three methods (`serialize`, `parseValue`, `parseLiteral`) as ordinary CFML functions.
