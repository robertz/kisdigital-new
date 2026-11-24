# Interceptors

Telling other code that something happened, with `announce()`.

## Interceptors and announce()

For telling other code that something happened without the handler knowing who is listening.

```bxs
mvc = boxExpressMvc( { handlers: …, interceptors: expandPath( "./interceptors" ), services: svc } )
```

```bxs
// interceptors/Notifier.bx
class {

	property name="mailer";

	function onItemAdded( event, data, rc, prc ) {
		mailer.send( "New item: #data.item.name#" )
	}

}
```

```bxs
// in an action
event.announce( "onItemAdded", { item: item } )
```

- Each public function of an interceptor listens for the event of that name. Interceptors are created once at startup and get the same [property injection](/projects/boxlang-express-mvc/docs/services) as handlers, so the same rule applies: nothing about a request goes in `variables`.
- Listeners run in file-name order, in the request's thread. One that returns `true` stops the rest. An error goes to the app's error handler like any other.
- An event nobody listens for does nothing, so a misspelt name fails silently.
- `event.announce( name, data, true )` runs the listeners on another thread and returns at once. The response may have gone by the time they run, so they must not touch it; an error there is printed, not handled.

## Outside a request

In a scheduled job or a service, call `mvc.announce( name, data )`. Listeners then get a null `event` and empty `rc` and `prc`.

## No built-in events

There are no built-in events such as ColdBox's `preProcess`. Middleware and `res.onBeforeSend()` cover those.
