# WebSub

`webSub()`: have a feed's hub push new posts to you instead of polling.

## The subscriber's side

A feed with a hub (`feed.hubs`) can push new posts to you the moment they're published, instead of you polling for them. `webSub( overrides = {} )` returns the subscriber's side of [WebSub](https://www.w3.org/TR/websub/) (and PubSubHubbub before it). You keep the state and serve the callback address; it does the protocol. There are three moments:

```bxs
hub = webSub()

// 1. Ask the hub to push. Keep the secret with the subscription.
secret = hub.newSecret()
answer = hub.subscribe( feed.hubs[ 1 ], feed.feedUrl, "https://example.com/websub/#token#", { secret: secret } )
// { accepted: true, status: 202, body: "" }

// 2. The hub checks with a GET to your callback. Echo its challenge, or refuse.
check = hub.challenge( queryParams, feed.feedUrl )
// { mode: "subscribe", accepted: true, challenge: "...", leaseSeconds: 864000, reason: "" }
if ( check.accepted ) {
	// reply 200 with check.challenge as the body; you're subscribed for check.leaseSeconds
} else {
	// reply 404; when check.mode is "denied" the hub refused, and check.reason says why
}

// 3. The hub POSTs new content to your callback. Reply 2xx either way; use it only if it's signed.
if ( hub.isSigned( rawBody, headers[ "X-Hub-Signature" ], secret ) ) {
	feed = parseFeed( rawBody, { baseUrl: feedUrl } )
}
```

- `subscribe( hubUrl, topicUrl, callbackUrl, options )`: the topic is the feed's own address, its `feedUrl`. `options.leaseSeconds` (10 days by default) is a request; the hub decides, and tells you in step 2. Renew before the lease runs out by subscribing again. `unsubscribe( hubUrl, topicUrl, callbackUrl )` asks the hub to stop; it checks that the same way, with mode `"unsubscribe"`, and `accepted` only says the request is well-formed: agree only if you really want to stop.
- Put something unguessable in each callback address (the `token` above) so you can tell which subscription a request is for, and so nobody else can find it.
- `isSigned( body, signature, secret )` takes the body exactly as it arrived, as bytes or a string, and the `X-Hub-Signature` header (`sha1=`, `sha256=`, `sha384=` or `sha512=` and a hex HMAC). It compares in constant time. Without a secret nothing counts as signed, so always subscribe with one.
- Requests to the hub use the module's `userAgent` and `timeoutSeconds`, don't follow redirects, and refuse private addresses unless `allowPrivateAddresses` is set. Pass overrides to `webSub( { ... } )`.
- A pushed body may hold only the new items, so merge it into what you have rather than replacing it. Keep polling too, less often: hubs fail quietly.
