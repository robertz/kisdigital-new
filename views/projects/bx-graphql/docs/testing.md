# Testing

The module's own specs run headlessly with TestBox, and the same setup works for testing a schema of yours.

## Running the module's specs

```bash
boxlang setup-tests.bxs   # once per checkout
boxlang run-tests.bxs     # every time after that
```

`run-tests.bxs` exits non-zero on any failure or error, so it suits CI: run `setup-tests.bxs` once beforehand, for example in an image build step.

`setup-tests.bxs` creates a `boxlang_modules/bxgraphql` symlink that points back at the checkout, so BoxLang discovers it as a real module and loads `libs/` onto the classloader. Modules are discovered once, when the BoxLang process starts, which is why setup is its own command and not part of `run-tests.bxs`.

## What the specs cover

| Spec | Covers |
|---|---|
| `GraphQLServiceSpec` | The resolver convention against a real engine: the property fallback, resolver precedence, query variables reaching arguments, and errors for an invalid query. |
| `GraphQLServiceConfigSpec` | Startup validation: missing or invalid `schemaPaths` and `resolverBasePackage`. |
| `DataFetcherAdapterSpec` | Resolver dispatch in isolation, through a fake `DataFetchingEnvironment`. |
| `JavaClassFactorySpec` | Java class-handle resolution. |
| `ScalarsSpec` | `DateTime`, `Long` and a scalar given in `scalars`, as output, literal and variable. |
| `ClassInstanceSourceSpec` | Fields read from class instances rather than structs. |
| `CodeFirstSpec` | Schema and operations generated from annotated beans and services, alone and merged with a hand-written file. |
| `CodeFirstFeaturesSpec` | Enums, bean functions as fields, inheritance, defaults and deprecation, lists and nulls in inputs, authorization, structured errors, batch loaders, `instanceFactory`. |
| `AbstractTypesSpec` | Interfaces and unions. |
| `BifsSpec` | The `bxGraphQL()` BIF. |

## Testing your own schema

`execute()` needs no server, so a spec can build the service and assert on the struct it returns:

```bxs
it( "returns a widget by id", () => {
	var result = graphQLService.execute( query = '{ widget(id: "1") { name } }' )

	expect( result.errors ).toBeEmpty()
	expect( result.data.widget.name ).toBe( "Test Widget" )
} )
```

For code-first schemas, compare `getGeneratedSDL()` with a checked-in `.graphqls` file to catch a schema change you didn't intend. The module's own `CodeFirstSpec` does this against `tests/resources/codefirst/expected.graphqls`.

Paths passed to `expandPath()` resolve from the script that started the run (`run-tests.bxs`), not from the spec file, so write them relative to the repo root.
