# Getting Started

Install the module, set a User-Agent, and see what each function is for.

## Requirements

BoxLang **1.19+** (Java 21). The module ships its jars in `libs/`: [ROME](https://rometools.github.io/rome/) 2.1 with its modules, and JDOM 2. XML is parsed by ROME, the Java feed library; the module adds what a reader needs on top of it.

## Install

```bash
install-bx-module bx-feeds        # into BoxLang HOME
install-bx-module bx-feeds --local  # into ./boxlang_modules
box install bx-feeds              # with CommandBox
```

A copy in BoxLang HOME (`~/.boxlang/modules`) wins over one in `./boxlang_modules`, so remove an older install there first.

## What's in it

| Function | What it does |
|---|---|
| [`parseFeed()`](/projects/bx-feeds/docs/parsing) | Turns RSS, Atom or JSON Feed into one plain struct, whatever the format. |
| [`fetchFeed()`](/projects/bx-feeds/docs/fetching) | Gets a feed with a conditional GET, within a timeout and a size limit, and parses it. |
| [`findFeeds()`](/projects/bx-feeds/docs/finding-feeds) | Turns a pasted address into the feeds behind it. |
| [`discoverFeeds()`](/projects/bx-feeds/docs/finding-feeds#discovering-feeds-in-a-page-you-have) | Reads the feeds a page you already have links to. |
| [`parseOpml()` / `toOpml()`](/projects/bx-feeds/docs/opml) | Read and write subscription lists. |
| [`webSub()`](/projects/bx-feeds/docs/websub) | Subscribes to a feed's hub so new posts are pushed to you. |

## Settings

Set these in `boxlang.json`:

```bxson
"modules": {
	"bxFeeds": {
		"settings": {
			"userAgent": "Feedhouse/1.0 (+https://feedhouse.app)",
			"timeoutSeconds": 15
		}
	}
}
```

Or pass any of them in the options of one call: `fetchFeed( feedUrl, { timeoutSeconds: 5 } )`.

| Setting | Default | Meaning |
|---|---|---|
| `userAgent` | `"bx-feeds/<version> (+https://github.com/robertz/bx-feeds)"` | The `User-Agent` sent with every fetch. Set it to your app's name and a URL: publishers block clients they can't identify. |
| `timeoutSeconds` | `20` | The longest a whole fetch may take, redirects and body included. |
| `maxBytes` | `10485760` (10 MB) | The largest response body accepted, counted after gzip is undone. |
| `maxRedirects` | `5` | How many redirects to follow before giving up. |
| `fallbackUserAgents` | `[]` | User-Agents to try, in order, when a site refuses `userAgent` with a 401 or 403. Some sites let only browsers through, so a browser's User-Agent string here gets their feeds. See [Sites that make fetching hard](/projects/bx-feeds/docs/fetching#sites-that-make-fetching-hard). |
| `pauseAfter429` | `true` | After a site answers a feed fetch with 429, leave it alone for a while: fetches of its feeds return a 429 marked `paused` without asking it. |
| `retryNotFound` | `{ pattern: "", delaysMs: [] }` | For hosts that now and then answer 404 for a feed that exists: an address matching `pattern` (a regular expression) that gets a 404 is asked again after each of `delaysMs`. |
| `allowPrivateAddresses` | `false` | Let `fetchFeed()` reach `localhost` and private, link-local and other non-public addresses. Leave it off wherever users choose what's fetched. Turn it on for feeds on your own network, and in tests against a local server. |

## How it differs from cffeed and bx-rss

bx-compat-cfml's `new feed()` is a thin shim over a `bx:feed` component that the compat module doesn't contain; that component comes from Ortus's [bx-rss](https://github.com/ortus-boxlang/bx-rss), which also has an `rss()` BIF. bx-rss is a `cffeed` replacement: it reads a feed from a URL or a file into a query or an items array, understands iTunes and Media RSS tags, and can *create* feeds.

bx-feeds doesn't create feeds. It does the things a reader polls with, which bx-rss's documentation doesn't offer: conditional GET, a size limit, permanent-redirect reporting, parsing from a string or bytes you fetched yourself, JSON Feed, stable item ids, relative URL resolution, repairs for broken feeds, polling hints, Podcasting 2.0 tags, OPML, finding a site's feeds, WebSub, and tested protection against XML attacks. Use bx-rss to port `cffeed` code or publish a feed; use bx-feeds to subscribe to other people's.

## The models

The BIFs are thin wrappers over six classes you can also use directly:

```bxs
parser    = new bxModules.bxFeeds.models.FeedParser()                       // .parse( input, options )
fetcher   = new bxModules.bxFeeds.models.FeedFetcher( { userAgent: "Mine/1.0" } )  // .fetch( feedUrl, options )
discovery = new bxModules.bxFeeds.models.FeedDiscovery()                    // .discover( html, baseUrl )
finder    = new bxModules.bxFeeds.models.FeedFinder( { userAgent: "Mine/1.0" } )   // .find( pageUrl, options )
opml      = new bxModules.bxFeeds.models.Opml()                             // .parse( input ), .build( list, title )
hub       = new bxModules.bxFeeds.models.WebSub()                           // .subscribe(), .unsubscribe(), .challenge(), .isSigned()
```

## Not yet

- The rest of Media RSS (ratings, credits, keywords) and of Podcasting 2.0 (value time splits, trailers, licenses, `podcast:txt`, remote items).
- Picking a transcript or an enclosure for you, and taking an item's image from its content: those are a reader's choices.
- Dates in other languages, and ambiguous ones like `02/11/2026`.
- Sharing pauses and accepted User-Agents between servers, or keeping them across a restart.
- More site patterns for `findFeeds()` (YouTube handles, Substack, Medium).
- Publishing to a hub, and storing WebSub subscriptions: the module does the protocol, the state is yours.
- Polling, scheduling, HTML sanitizing and full-text extraction belong in the app or another module, not here.
