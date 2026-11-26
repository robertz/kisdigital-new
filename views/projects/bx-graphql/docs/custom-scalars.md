# Custom Scalars

A `scalar` the schema declares needs its conversions, given in `scalars`. `DateTime` and `Long` are built in.

## Defining one

```bxs
"scalars" : {
	"Upper" : {
		"serialize"  : ( value ) => ucase( value ),   // a resolver's value, on its way out
		"parseValue" : ( value ) => ucase( value )    // an argument, on its way in
	}
}
```

| Conversion | Required | What it handles |
|---|---|---|
| `serialize` | Yes | A value a resolver returned, on its way out. |
| `parseValue` | Yes | An argument passed as a variable, on its way in. |
| `parseLiteral` | No | A value written in the query itself. Defaults to `parseValue`, given the literal as a plain string, number or boolean. |

What `parseValue` returns is what the resolver or service function receives: a date, a `java.time` value, a `BigDecimal`. It isn't turned to text on the way.

Whatever a conversion throws becomes an entry in `errors`, not a failed request. A declared scalar with no conversions fails at construction time.

## Built-in scalars

Two need no configuration, and are declared for you when a [generated field](/projects/bx-graphql/docs/code-first#how-boxlang-types-map) uses them:

| Scalar | Out | In |
|---|---|---|
| `DateTime` | A BoxLang date, a `java.time` or `java.util` date, or an ISO string with an offset, always written in UTC (`2026-01-31T09:30:00Z`). | The resolver receives the same normalized ISO-8601 string. |
| `Long` | A whole number up to 64 bits. | The same. |
