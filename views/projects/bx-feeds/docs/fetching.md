# Fetching

`fetchFeed()`: conditional GET, redirects, limits, and sites that make fetching hard.

## fetchFeed()

`fetchFeed( feedUrl, options = {} )` fetches and parses in one call.

```bxs
result = fetchFeed( feed.url, { etag: feed.etag, lastModified: feed.lastModified } )

if ( len( result.permanentUrl ) ) {
	// the feed moved for good: save result.permanentUrl as its address
}
if ( result.notModified ) {
	// nothing new
} else if ( result.status == 200 ) {
	// result.feed is the parsed feed; save result.etag and result.lastModified for next time
} else {
	// 404, 410, 429, 500...: result.feed is null
}
```

| Option | Meaning |
|---|---|
| `etag`, `lastModified` | The values a previous fetch returned. They are sent as `If-None-Match` and `If-Modified-Since`. |
| `parse` | `false` to get a 200's bytes in `body` instead of a parsed `feed`: for a page you'll run `discoverFeeds()` on, or anything else you want fetched with the same limits. |
| Any module setting | Overrides it for this call: `userAgent`, `timeoutSeconds`, `maxBytes`, `maxRedirects`, `fallbackUserAgents`, `pauseAfter429`, `retryNotFound`, `allowPrivateAddresses`. |
| `accept` | An `Accept` header, for fetching something that isn't a feed. |
| `httpOnly`, `collapseRevisions`, `maxItems` | Passed on to the parser. See [Parsing](/projects/bx-feeds/docs/parsing). |

| Result | Meaning |
|---|---|
| `status` | The HTTP status of the last response. |
| `notModified` | True for a 304. |
| `etag`, `lastModified` | The response's validators, as sent. On a 304 that repeats none, the ones you passed in. |
| `finalUrl` | The address that finally answered, after redirects. Relative URLs in the feed are resolved against it. A redirect's default port (`https://host:443/`) is dropped, so it's the address people type. |
| `permanentUrl` | Where the feed has permanently moved, or `""`. It's the end of the leading run of 301 and 308 redirects; a redirect after a temporary one (302, 303, 307) isn't counted, since the temporary hop may point elsewhere tomorrow. |
| `contentType` | The response's `Content-Type` header, or `""`. |
| `retryAfterSeconds` | How long the server asked to be left alone (`Retry-After`, sent as seconds or as a date), or 0. Worth honoring on a 429 or 503. |
| `maxAgeSeconds` | How long the server says its answer stays fresh: `Cache-Control: max-age`, else the time left until `Expires`, or 0 (also for `no-cache` and `no-store`). A reason not to poll sooner. |
| `challenged` | True when a refusal (401, 403, 429 or 503) is a bot check: Cloudflare's "Just a moment", or a CAPTCHA from DataDome, PerimeterX, reCAPTCHA or hCaptcha. No fetch can pass one, so retrying won't help. |
| `paused` | True when no request was made because the site is being left alone after a 429. `status` is 429 and `retryAfterSeconds` is how much longer. |
| `links` | The response's `Link` headers as `[ { url, rel } ]`, one entry per rel. Some feeds name their WebSub `hub` and `self` here rather than in the document. |
| `feed` | The `parseFeed()` struct on a 200. Null for any other status, and with `parse: false`. |
| `body` | The 200's bytes with `parse: false`. Null otherwise. |

Only `http` and `https` are fetched, and redirects to anything else are refused. Gzip is asked for and undone. Every address on the way, the first and each redirect's, must be a public one unless `allowPrivateAddresses` is set.

## Sites that make fetching hard

**Sites that refuse your User-Agent.** With `fallbackUserAgents` set, a 401 or 403 is asked again as each fallback in turn. The first one a host accepts is remembered, and later fetches to that host use it straight away; when your own `userAgent` works again, it's forgotten. With no fallbacks, or none accepted, you get the refusal as it came.

**Bot checks.** A refusal whose page is a bot check comes back with `challenged: true`. Fallbacks aren't tried on one, since it refuses every client alike. Tell the user the site wants a browser, rather than "feed not found".

**Sites that answer 429.** When a feed fetch gets a 429, the whole site is left alone: for as long as its `Retry-After` says (an hour at most), or 15 minutes when it doesn't say, doubling for each 429 in a row up to four hours. Until then `fetchFeed()` for any feed on that site returns at once with `status: 429` and `paused: true`, making no request. A site here is the registrable domain, so every `*.tumblr.com` blog shares one pause, as they share one limit. The first 200 or 304 resets the doubling. A 429 for a fetch with `parse: false` (a page, an image) doesn't pause anything, and such fetches aren't held back. Turn all of it off with `pauseAfter429: false`.

**Hosts that answer 404 by mistake.** `retryNotFound: { pattern: "^https://www\.youtube\.com/feeds/", delaysMs: [ 500, 2000 ] }` asks a matching address again after each delay while it keeps answering 404. Everything stays inside `timeoutSeconds`.

What's remembered (accepted User-Agents, pauses) is held in memory and shared by every fetch in the BoxLang runtime; it's gone on restart, and isn't shared between servers. The model shows and clears it:

```bxs
fetcher = new bxModules.bxFeeds.models.FeedFetcher()
fetcher.pausedSites()                      // [ { site: "tumblr.com", seconds: 840, refusals: 1 } ], soonest back first
fetcher.pausedSeconds( feedUrl )           // 0 when the site may be asked now
fetcher.endPause( feedUrl )                // ask again now, keeping count of its 429s
fetcher.forget( feedUrl )                  // forget this site's pause, count and accepted User-Agent
fetcher.forget()                           // forget everything
```

## Errors

| Type | When |
|---|---|
| `Feeds.ParseError` | The input isn't a readable feed or OPML file: garbage bytes, HTML, broken XML, JSON that isn't a JSON Feed, a path that isn't a file. `message` is safe to show; `detail` has the parser's reason. |
| `Feeds.FetchError` | The feed couldn't be fetched: DNS, a refused connection, TLS, an address that isn't http(s). `detail` has the reason. |
| `Feeds.FetchError.Timeout` | The fetch took longer than `timeoutSeconds`. |
| `Feeds.FetchError.TooLarge` | The body is over `maxBytes`. |
| `Feeds.FetchError.TooManyRedirects` | More than `maxRedirects` redirects. |
| `Feeds.FetchError.PrivateAddress` | The address, or one it redirected to, isn't a public one and `allowPrivateAddresses` is off. |

`catch ( "Feeds.FetchError" e )` catches all five fetch errors. An HTTP error status is not an exception: it comes back in `result.status`.
