# Authorization

Mark a function or a class `@graphqlRequires`, and your `authorizer` is asked before any guarded function is called.

## Guarding fields

`@graphqlRequires( "what" )` goes on a service function, a bean's `@graphqlField` function, or a whole class:

```bxs
@graphqlQuery
@graphqlRequires( "admin" )
array function secrets(){ ... }
```

A function's own annotation replaces its class's. A class without one takes its nearest parent's, so a guard on a base class covers the functions its children expose.

## The authorizer

```bxs
"authorizer" : ( requirement, context, info ) => arrayContains( context.user.roles, requirement )
```

| Argument | What it holds |
|---|---|
| `requirement` | The annotation's value, or `""` for a bare `@graphqlRequires`. |
| `context` | What was passed to `execute()`. |
| `info` | `{ type, field, args }` for the field being asked for. |

Anything but `true` refuses the field. It resolves to null, `errors` gains `Not authorized: Query.secrets` (type `BxGraphQL.NotAuthorized`), and the rest of the query carries on.

Marking anything `@graphqlRequires` without setting `authorizer` fails at construction time.

> [!WARNING] Properties and hand-written resolvers aren't guarded
> `@graphqlRequires` covers functions only. Check `context` yourself in a hand-written resolver, and expose a sensitive property through a guarded `@graphqlField` function instead of the property.
