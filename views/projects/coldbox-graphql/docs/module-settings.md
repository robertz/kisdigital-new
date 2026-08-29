# Module Settings

Everything configurable in config/ColdBox.cfc, and what each setting does.

## Setting them

```cfscript
moduleSettings = {
    "coldbox-graphql" = {
        schemaPaths          : [ "/graphql/schema" ],
        resolverBasePackage  : "models.resolvers",
        basePath             : "/graphql",
        enableIntrospection  : true,
        customScalarProvider : ""
    }
};
```

## Reference

| Setting | Required | Default | Description |
|---|---|---|---|
| `schemaPaths` | Yes | — | Array of paths to `.graphqls` files. Each entry may be a literal file, a directory (all `*.graphqls` files in it), or a wildcard (`/path/*.graphqls`). All files are parsed and merged into one schema. Module load fails fast if this is empty or any path doesn't resolve to a file. See [Schema Files](/projects/coldbox-graphql/docs/schema-files) for the recommended layout. |
| `resolverBasePackage` | Yes | — | WireBox package resolvers live under, e.g. `models.resolvers`. Must point to a directory reachable from your app root (WireBox resolves it the same way it resolves any dotted component path). |
| `basePath` | No | `/graphql` | The URL the module registers `POST` for automatically at startup. |
| `enableIntrospection` | No | `true` | Set `false` in production if you don't want `__schema`/`__type` queries answered. |
| `customScalarProvider` | No | `""` | WireBox mapping name of a CFC that returns custom `GraphQLScalarType` instances. See [Custom Scalars](/projects/coldbox-graphql/docs/custom-scalars). |
