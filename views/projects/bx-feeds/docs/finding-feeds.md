# Finding Feeds

`findFeeds()` and `discoverFeeds()`: from a pasted address to the feeds behind it.

## Finding a site's feeds

`findFeeds( pageUrl, options = {} )` is for an "add a feed" box: give it whatever was pasted and it returns the feeds behind it, each one fetched and parsed to make sure.

```bxs
findFeeds( "example.com/blog", { userAgent: "Feedhouse/1.0 (+https://feedhouse.app)" } )
// [ { url: "https://example.com/feed.xml", title: "Example Blog", link: "https://example.com/", type: "rss_2.0", source: "advertised" } ]
```

It tries four things in order, and the first that finds anything ends the search:

| `source` | What |
|---|---|
| `itself` | The address is already a feed. |
| `advertised` | The feeds its page links with `<link rel="alternate">`: up to five, every one that really is a feed. |
| `pattern` | A site whose feed address follows from the page's: a Reddit subreddit or user, a GitHub repository (its releases) or user, a Mastodon profile or hashtag. |
| `path` | The paths feeds usually live at (`/feed`, `/rss`, `/feed.xml`, `/rss.xml`, `/atom.xml`, `/index.xml`, `/feed.json` and two more), stopping at the first that works. |

An address without a scheme is taken as `https://`. A feed's `url` is the one asked for, unless the server said it has permanently moved. Nothing found is an empty array. A page that can't be reached at all throws `Feeds.FetchError`; a candidate that can't is skipped.

`options` takes everything `fetchFeed()` does, applied to every request, plus `budgetSeconds` (60 by default): the longest the whole search may take. At worst it makes about sixteen requests, all to the site you named or to addresses its page gave, each held to the same limits and the same private-address check as any fetch.

## Discovering feeds in a page you have

`discoverFeeds( html, baseUrl = "" )` is the step of `findFeeds()` that reads the page, for when you fetched it yourself. It returns the feeds the page links with `<link rel="alternate">`, in page order, with repeats dropped:

```bxs
discoverFeeds( html, "https://example.com/blog/" )
// [ { url: "https://example.com/feed.xml", type: "application/rss+xml", title: "Posts" } ]
```

It recognizes `application/rss+xml`, `application/atom+xml`, `application/feed+json` and `application/json`, and honors a `<base href>` in the page. It reads the tags with a pattern rather than an HTML parser, which is enough for `<link>` tags. It makes no requests, so nothing it returns has been checked.
