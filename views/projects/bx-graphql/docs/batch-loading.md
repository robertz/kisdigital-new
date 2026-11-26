# Batch Loading

A list of 50 widgets that each look up their maker is 50 lookups. A loader turns them into one.

## Define a loader

```bxs
"loaders" : {
	"makers" : ( keys, context ) => makerService.byIds( keys )
}
```

The loader receives every key asked for and returns either:

- a struct of values by key (a key it has nothing for resolves to null), or
- an array with one value per key, in the keys' order.

## Use it from a field

```bxs
@graphqlField( "Maker" )
function maker( any env ){
	return arguments.env.getDataLoader( "makers" ).load( variables.makerId );
}
```

`load()` returns a promise, which the function returns as it is. graphql-java gathers the keys asked for across that level of the query, drops repeats, and calls the loader once.

Any [resolver](/projects/bx-graphql/docs/resolvers) can use a loader the same way, through its `env` argument. Loaded values last for one `execute()`.
