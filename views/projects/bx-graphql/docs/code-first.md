# Code-First Schema

Annotate the classes you already have. The module generates SDL from them and wires each generated `Query` and `Mutation` field straight to its method.

```bxs
graphQLService = bxGraphQL( {
	"modelPaths"   : [ expandPath( "models/beans" ) ],
	"servicePaths" : [ expandPath( "models/services" ) ]
} )
```

Both settings take class files or directories, searched recursively. Neither needs `schemaPaths` or `resolverBasePackage`, though you can [use them together](#mixing-with-hand-written-schema).

## Beans become types and inputs

```bxs
/** A thing we sell. */
@graphqlType
@graphqlInput
class accessors="true" {

	@graphqlId
	property name="id" type="numeric";

	/** What it's called on the shelf. */
	property name="name" type="string" required="true";

	property name="maker" type="Maker";

	@graphqlField( "[Tag!]" )
	@graphqlInputField( "[String!]" )
	property name="tags" type="array";

	@graphqlReadOnly
	property name="createdAt" type="date";

	@graphqlIgnore
	property name="passwordHash" type="string";

}
```

generates

```graphql
scalar DateTime

"""A thing we sell."""
type Widget {
	id: ID
	"""What it's called on the shelf."""
	name: String!
	maker: Maker
	tags: [Tag!]
	createdAt: DateTime
}

"""A thing we sell."""
input WidgetInput {
	id: ID
	"""What it's called on the shelf."""
	name: String!
	maker: MakerInput
	tags: [String!]
}
```

Only annotated classes are exposed. Within one, every property is a field unless ignored, inherited properties included (the parents' first).

## Annotations

| Annotation | On | Meaning |
|---|---|---|
| `@graphqlType` or `@graphqlType( "Name" )` | class | Emit `type Name`. Default name: the class's simple name. |
| `@graphqlInput` or `@graphqlInput( "Name" )` | class | Emit `input Name`. Default name: `{SimpleName}Input`. |
| `@graphqlId` | property | The field is an `ID`. |
| `@graphqlField( "SDL type" )` | property | The field's type, verbatim (so include any `!`). |
| `@graphqlInputField( "SDL type" )` | property | The same, for the input only. Without it the input uses `@graphqlField`'s. |
| `@graphqlReadOnly` | property | In the type, not the input. |
| `@graphqlWriteOnly` | property | In the input, not the type. |
| `@graphqlIgnore` | property | In neither. |
| `@graphqlDeprecated( "why" )` | property, function | Marks the type's field `@deprecated`. A doc comment's `@deprecated why` does the same. |
| `@graphqlField` or `@graphqlField( "SDL type" )` | function | The function is a field of the type (not the input). See [Functions as fields](#functions-as-fields). |
| `@graphqlImplements( "Node, Named" )` | class | The type `implements` those interfaces. See [Interfaces & Unions](/projects/bx-graphql/docs/interfaces-unions). |
| `@graphqlEnum( "A, B, C" )` | class | Emit `enum {SimpleName}` with those values, and nothing else from the class. See [Enums](#enums). |
| `@graphqlQuery` or `@graphqlQuery( "name" )` | function | A field of `Query`. See [Service methods](#service-methods-become-queries-and-mutations). |
| `@graphqlMutation` or `@graphqlMutation( "name" )` | function | A field of `Mutation`. |
| `@graphqlReturns( "SDL type" )` | function | The field's return type, verbatim. |
| `@graphqlRequires( "what" )` | class, function | Guarded. See [Authorization](/projects/bx-graphql/docs/authorization). |

An annotation's value needs parentheses: `@graphqlField( "[Tag!]" )`, not `@graphqlField "[Tag!]"`.

## How BoxLang types map

| BoxLang type | GraphQL type |
|---|---|
| `string` | `String` |
| `boolean` | `Boolean` |
| `integer`, `int` | `Int` |
| `numeric`, `float`, `double` | `Float` |
| `long` | `Long` |
| `date`, `datetime` | `DateTime` |
| an annotated class (`Maker`, `models.Maker`) | its type; its input when used in an input or as an argument |
| `Something[]` | `[Something!]` |
| `array`, `struct`, `any`, anything else | none: state it with `@graphqlField`, or construction fails naming the property |

`required="true"` adds `!`. `DateTime` and `Long` are declared for you when a generated field uses them; see [Custom Scalars](/projects/bx-graphql/docs/custom-scalars#built-in-scalars).

## Functions as fields

A public function on a bean marked `@graphqlField` is a field of its type, called on the bean when asked for. Its parameters become the field's arguments exactly as a service function's do, `context`, `env` and `args` included.

```bxs
/**
 * The name, as a URL would have it.
 *
 * @separator What goes between the words.
 */
@graphqlField
string function slug( string separator = "-" ){
	return lcase( replace( variables.name, " ", arguments.separator, "all" ) );
}
```

```graphql
"""The name, as a URL would have it."""
slug(
	"""What goes between the words."""
	separator: String! = "-"
): String
```

`@graphqlField( "Maker" )` states the return type verbatim.

## Enums

```bxs
/** Where a widget is in its life. */
@graphqlEnum( "ACTIVE, PAUSED, RETIRED" )
class {
}
```

generates `enum Status { ACTIVE PAUSED RETIRED }`, named after the class. The values are strings in BoxLang, so a property or parameter that holds one is typed `string` and names the enum:

```bxs
@graphqlField( "Status" )
property name="status" type="string";

string function byStatus( string status = "ACTIVE" graphqlType="Status" ){ ... }
```

Typing it as the class (`type="Status"`) fails at construction time, since BoxLang would refuse the string.

## Service methods become queries and mutations

```bxs
class {

	/** One widget by id. */
	@graphqlQuery
	Widget function widget( required numeric id graphqlType="ID!", struct context ){ ... }

	@graphqlQuery
	@graphqlReturns( "[Widget!]!" )
	array function widgets( numeric limit = 20 ){ ... }

	@graphqlMutation
	Widget function saveWidget( required Widget input ){ ... }

	@graphqlMutation( "renameWidget" )
	Widget function rename( required numeric id graphqlType="ID!", required string name ){ ... }

}
```

generates

```graphql
type Query {
	"""One widget by id."""
	widget( id: ID! ): Widget
	widgets( limit: Float! = 20 ): [Widget!]!
}

type Mutation {
	saveWidget( input: WidgetInput! ): Widget
	renameWidget( id: ID!, name: String! ): Widget
}
```

The function must be public. The field takes the function's name, or the annotation's value. One instance of each service class is built at construction time, by [`instanceFactory`](/projects/bx-graphql/docs/getting-started#classes-that-need-dependencies) if given.

No operations are generated from a bean alone: a bean doesn't say how it's loaded or saved.

### Parameters and return types

- Each parameter becomes an argument, its type mapped as above and `!` added when `required`. `graphqlType="..."` on a parameter states the type verbatim instead.
- Parameters named `context` and `env` receive what a [resolver](/projects/bx-graphql/docs/resolvers#arguments)'s would, and `args` the arguments as plain structs and arrays. None of the three is an argument in the schema.
- The return type is mapped from the function's. `@graphqlReturns( "..." )` states it verbatim, and is needed for `array`, `struct`, `any` or no declared type.
- A doc comment's `@parameterName ...` line becomes that argument's description. `@graphqlDeprecated( "why" )`, or a doc comment's `@deprecated why`, marks the field deprecated.

### Defaults and nulls

- A default that is a plain string, number or boolean is written into the schema, and makes the argument non-null: `limit: Float! = 20` can be left out, but not given as null.
- An argument the query leaves out isn't passed, so the function's own default applies whether or not it could be written into the schema.
- An argument given as `null` reaches the function as null when the parameter has no default.
- When the parameter has a default, a null is refused rather than quietly replaced, because BoxLang gives a parameter its default whenever it receives null. A plain default is refused by the schema (the argument is non-null). A default that is an expression (`since = now()`) is refused by an error on that field, `BxGraphQL.NullArgument`.

### Input beans

- A parameter typed as an `@graphqlInput` class receives an instance of that class, filled through its setters. So do nested beans, and lists of them: a property typed `Tag[]`, or typed `array` with `@graphqlInputField( "[TagInput!]" )`.
- A string for a property typed `date` becomes a date.
- Type the parameter `struct` (with `graphqlType="WidgetInput!"`) to receive the plain struct.
- A key given as `null` sets that property to null; a key left out leaves it alone. Both read as null on the bean afterwards. To tell them apart, take `args` as well and look at its keys: `arrayContainsNoCase( structKeyArray( args.input ), "price" )`. `structKeyExists()` is false for a null.

### Inheritance

Annotated functions inherited from a parent class count. When a parent and its child are both scanned, the field goes to the child, so the child's instance is the one called. That holds when the child overrides the function with the annotation repeated, too.

Two scanned classes that supply the same field, with neither descending from the other, fail at construction time.

## Mixing with hand-written schema

Generated SDL is merged with whatever `schemaPaths` supplies. When a hand-written file declares `Query` or `Mutation`, the generated fields are added with `extend type`.

A hand-written `extend type Widget { slug: String }` plus a `WidgetResolver.bx` with a `slug()` method adds a computed field to a generated type.

Declaring the same type by hand and by annotation, or the same field from two service functions, fails at construction time with `BxGraphQL.ConfigurationException`.

`getGeneratedSDL()` returns the generated SDL on its own; `printSchema()` returns the whole executable schema as SDL.
