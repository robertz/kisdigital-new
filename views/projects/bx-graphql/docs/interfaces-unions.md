# Interfaces & Unions

Write the interface or union in a `.graphqls` file; the module works out each value's concrete type.

## Declaring them

Interfaces and unions aren't generated from classes, so they go in a [schema file](/projects/bx-graphql/docs/schema-files):

```graphql
interface Named {
	name: String
}

union Found = Book | Film
```

A [generated type](/projects/bx-graphql/docs/code-first) joins an interface with `@graphqlImplements( "Named" )`, and a union by being listed in it.

## How the concrete type is found

For a field typed as an interface or union, each value's type is worked out in this order:

1. `{resolverBasePackage}/{InterfaceOrUnion}Resolver.bx`, if it has a `resolveType( value, context, env )` method: it returns the type's name.
2. A struct's `__typename` key.
3. A class instance's class: the type generated from it, else its simple name.

A value none of these can place is an error on that field.

```bxs
// models/resolvers/FoundResolver.bx
class {
	string function resolveType( any value, any context, any env ){
		return structKeyExists( arguments.value, "director" ) ? "Film" : "Book";
	}
}
```
