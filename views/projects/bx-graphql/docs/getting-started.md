# Getting Started

Install the module, build a service once, and execute a query.

## Requirements

BoxLang **1.15.0+**. It's developed and tested on 1.19.0; the [code-first](/projects/bx-graphql/docs/code-first) features read `getClassMetadata()`, which hasn't been tried on earlier versions. The module only runs on BoxLang: it isn't tested against Lucee or Adobe ColdFusion.

[graphql-java](https://www.graphql-java.com/) 26.0 ships in the module's `libs/` folder. BoxLang's module system loads those jars onto the module's classloader, so there is no classloader to register and no per-engine branching, unlike [coldbox-graphql](/projects/coldbox-graphql).

## Install

```bash
box install bx-graphql
```

## Quick start

```bxs
graphQLService = bxGraphQL( {
	"schemaPaths"         : [ expandPath( "/graphql/schema" ) ],
	"resolverBasePackage" : "models.resolvers"
} )

result = graphQLService.execute(
	query          = '{ widget(id: "1") { name } }',
	queryVariables = {},
	context        = ""
)
// result == { "data" : { "widget" : { "name" : "..." } }, "errors" : [] }
```

`bxGraphQL()` is a global BIF, registered when the module loads. It's a thin wrapper: `new bxModules.bxgraphql.models.GraphQLService( settings )` does the same thing if you'd rather be explicit about where it comes from.

`GraphQLService` builds the graphql-java engine once, when it's constructed, so build it at app startup and reuse it. `execute()` doesn't touch HTTP: wiring `POST /graphql` to it is your app's router's job.

## Two ways to describe a schema

| | You write | Read |
|---|---|---|
| Schema-first | `.graphqls` files, plus a resolver class for the fields that need logic | [Schema Files](/projects/bx-graphql/docs/schema-files), [Resolvers](/projects/bx-graphql/docs/resolvers) |
| Code-first | Annotations on the beans and services you already have | [Code-First Schema](/projects/bx-graphql/docs/code-first) |

The two mix: generated SDL is merged with whatever your `.graphqls` files supply.

## Settings

Passed as a struct to `bxGraphQL()`:

| Setting | Required | Description |
|---|---|---|
| `schemaPaths` | Yes, unless `modelPaths` or `servicePaths` is set | Array of paths to `.graphqls` files: literal files, directories or wildcards. See [Schema Files](/projects/bx-graphql/docs/schema-files). |
| `resolverBasePackage` | Yes, unless `modelPaths` or `servicePaths` is set | Where resolver classes live, as a dotted package path (`models.resolvers`). See [Resolvers](/projects/bx-graphql/docs/resolvers#where-resolvers-are-looked-for). |
| `modelPaths` | No | Array of class files or directories (searched recursively). Classes marked `@graphqlType` / `@graphqlInput` become types and inputs. See [Code-First Schema](/projects/bx-graphql/docs/code-first). |
| `servicePaths` | No | Array of class files or directories (searched recursively). Public functions marked `@graphqlQuery` / `@graphqlMutation` become fields of `Query` / `Mutation`. |
| `instanceFactory` | No | `( classPath, meta, kind ) => instance`, for classes that need dependencies. See [below](#classes-that-need-dependencies). |
| `authorizer` | When anything is marked `@graphqlRequires` | `( requirement, context, info ) => boolean`. See [Authorization](/projects/bx-graphql/docs/authorization). |
| `loaders` | No | `{ name : ( keys, context ) => values }`. See [Batch Loading](/projects/bx-graphql/docs/batch-loading). |
| `structuredErrors` | No | `true` to get `errors` as structs rather than message strings. See [Errors](/projects/bx-graphql/docs/errors). |
| `onError` | No | `( detail ) => {}`, called once per error. See [Errors](/projects/bx-graphql/docs/errors#logging-with-onerror). |
| `scalars` | No | `{ ScalarName : { serialize, parseValue, parseLiteral? } }`. See [Custom Scalars](/projects/bx-graphql/docs/custom-scalars). |

A setting that can't work fails when the service is constructed, with `BxGraphQL.ConfigurationException`, not on the first query.

### Classes that need dependencies

Services and resolvers are built with a bare `new` unless you set `instanceFactory`:

```bxs
"instanceFactory" : ( classPath, meta, kind ) => {
	// classPath: the class file's absolute path, without its extension
	// meta:      its getClassMetadata()
	// kind:      "service", "resolver" or "input"
}
```

`"service"` and `"resolver"` are asked for once and the instance is kept. `"input"` is asked for every input bean, so return a new one each time.

## Executing queries

```bxs
result = graphQLService.execute(
	query          = "...",    // required
	queryVariables = {},       // optional: GraphQL $variables
	context        = ""        // optional: passed as it is to every resolver's `context`
)
```

It returns a plain struct, `{ data : {...}, errors : [...] }`, so callers never touch graphql-java classes. `errors` is always present, and empty on success.

## Demo

[bx-graphql-demo](https://github.com/robertz/bx-graphql-demo) serves bx-graphql over HTTP with [boxlang-express](/projects/boxlang-express): a small offline dataset of users, posts and comments behind one `/graphql` endpoint, with a query console in the browser.

```bash
git clone https://github.com/robertz/bx-graphql-demo.git
cd bx-graphql-demo
box install
boxlang app.bxs
```

## Not yet

- Operations (CRUD) generated from a bean alone.
- Interfaces, unions and input unions generated from classes: they are written in SDL. See [Interfaces & Unions](/projects/bx-graphql/docs/interfaces-unions).
- Subscriptions.
- Guarding a property with `@graphqlRequires` (functions only).
- An introspection on/off toggle. Introspection is always available, as graphql-java has it by default.
