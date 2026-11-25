# Parsing

`parseFeed()`: one struct for RSS, Atom and JSON Feed, with stable item ids.

## parseFeed()

RSS 0.9x, 1.0 (RDF) and 2.0, Atom 0.3 and 1.0, and JSON Feed 1.0 and 1.1 all come back in the same shape.

`parseFeed( input, options = {} )` takes the feed as a string, as bytes, or as the path of a file.

```bxs
feed = parseFeed( bytes, { baseUrl: "https://example.com/blog/feed.xml", contentType: "text/xml; charset=ISO-8859-1" } )
```

| Option | Meaning |
|---|---|
| `baseUrl` | Where the feed came from. Relative URLs are resolved against it. Without it they are returned as written. |
| `contentType` | The HTTP `Content-Type` header the bytes came with, used to work out their charset. |
| `httpOnly` | `true` to take out every returned URL that isn't http(s): a single one becomes `""`, one in a list (`hubs`, `enclosures`, transcripts, funding) is dropped with its entry. URLs inside `contentHtml` and `summary` are left for your sanitizer, and ids aren't touched. |
| `collapseRevisions` | `true` to take the `#3` off an id that is the item's own link plus an edit number, as some news feeds write their guids. Without it every edit is a new item. |
| `maxItems` | Keep only the first so many items. `0`, the default, keeps them all. |
| `maxLength` | Refuse a document of more characters than this with `Feeds.ParseError`. `0`, the default, is no limit. |

It returns:

```bxs
{
	type        : "rss_2.0",       // rss_0.9, rss_0.91U, rss_0.92, rss_1.0, rss_2.0, atom_0.3, atom_1.0, json_1, json_1.1
	title       : "Example Show",
	link        : "https://example.com/",          // the site
	feedUrl     : "https://example.com/feed.xml",  // what the feed says its own address is
	description : "Two people talking",
	language    : "en-GB",
	updated     : {ts '2026-11-03 09:30:00'},      // UTC datetime or null
	image       : "https://example.com/art.jpg",
	hubs        : [ "https://hub.example/" ],      // WebSub
	nextUrl     : "https://example.com/feed.xml?page=2",
	poll        : { minutes: 180, skipHours: [ 3, 4 ], skipDays: [ "sunday" ] },
	podcast     : { author, owner, type, explicit, categories, persons, funding, ... },  // see Podcasts
	items       : [ {
		id          : "tag:example.com,2026:hello",
		title       : "Hello, world",
		link        : "https://example.com/hello",
		published   : {ts '2026-11-02 15:00:00'},  // UTC datetime or null
		updated     : null,                        // UTC datetime or null
		authors     : [ "Ada Lovelace" ],
		summary     : "A short hello.",
		contentHtml : "<p>The <em>full</em> hello.</p>",
		categories  : [ "News", "BoxLang" ],
		enclosures  : [ { url: "https://example.com/hello.mp3", type: "audio/mpeg", length: 34216300 } ],
		commentsUrl : "https://example.com/hello#comments",
		image       : "https://example.com/hello.jpg",
		durationSeconds : 2710,
		podcast     : { season, episode, episodeType, explicit, transcripts, chaptersUrl, persons, ... }  // see Podcasts
	} ]
}
```

Every key is always there, whatever the format. Text that's missing is `""`, a list that's missing is `[]`, a number that's unknown is `0` (an enclosure's `length`, `durationSeconds`, `poll.minutes`), and a date that's missing or unreadable is null. Test dates with `isNull( item.published )`: where bx-compat-cfml is loaded, `keyExists()` is false for a null.

## The feed

- `link` is the site; `feedUrl` is the feed's `rel="self"` link (JSON `feed_url`), which can differ from where you fetched it.
- `hubs` are its WebSub hubs (`rel="hub"`, JSON `hubs`). `nextUrl` is the page of older entries: RFC 5005's `rel="next"`, else `rel="prev-archive"`, or JSON `next_url`.
- `poll.minutes` is how often the publisher says to check: RSS `<ttl>`, else `sy:updatePeriod` over `sy:updateFrequency`. `skipHours` (0 to 23, UTC) and `skipDays` (lowercase names) are RSS's. They are hints; a schedule that skips every hour or every day is ignored.
- `image` is a podcast's `itunes:image` when it has one, else the RSS `<image>`, the Atom logo or icon, or the JSON Feed icon.

## An item

- `contentHtml` is the best body the item has: the full content (`content:encoded`, Atom `<content>`, JSON `content_html`) when there is one, otherwise the description, otherwise a Media RSS description (the only text a YouTube video has). Plain text (Atom `type="text"`, JSON `content_text`, Media RSS) is escaped into HTML. `summary` is the feed's own summary or description as it was written, so for an RSS item with only a `<description>` the two are the same.
- `published` and `updated` are what the feed said, with no filling in. Many Atom feeds only have `updated`, so a reader wants `item.published ?: item.updated`.
- `title` is plain text: entities are decoded (once more than XML does, since many feeds escape twice), and tags are stripped only from a title the feed declares as HTML, so `<input> considered harmful` keeps its brackets.
- `authors` and `categories` are trimmed, entity-decoded names with repeats dropped. RSS's `ada@example.com (Ada Lovelace)` becomes `Ada Lovelace`.
- `enclosures` are in feed order, with `podcast:alternateEnclosure` files after the item's own. Choosing which to play is yours.
- `commentsUrl` is RSS `<comments>`, or an Atom `rel="replies"` link to a page.
- `image` is the episode's `itunes:image`, else a Media RSS thumbnail or image, or JSON `image` / `banner_image`. Pictures inside the content aren't looked at.
- `durationSeconds` is from `itunes:duration` (`2710`, `45:10` or `0:45:10`) or a JSON attachment's `duration_in_seconds`. A day or more is taken as a typo and returned as 0.

## Podcasts

Every feed and every item has a `podcast` struct with the same keys, empty when the feed isn't a podcast. iTunes tags and [Podcasting 2.0](https://podcastindex.org/namespace/1.0) tags are read into it:

```bxs
feed.podcast = {
	author     : "Example Media",                       // itunes:author
	owner      : { name: "Olive Owner", email: "olive@example.com" },
	type       : "episodic",                            // or "serial": play oldest first
	explicit   : false,
	complete   : false,                                 // true: no more episodes are coming
	newFeedUrl : "",                                    // itunes:new-feed-url: the show has moved here
	categories : [ "Technology", "Technology > Tech News" ],
	guid       : "917393e3-1b1e-5cef-ace4-edaa54e1f810", // podcast:guid, the same in every copy of the feed
	locked     : true,                                  // podcast:locked: don't import this feed elsewhere
	medium     : "podcast",                             // or music, video, audiobook, newsletter...
	location   : { name: "Austin, TX", geo: "geo:30.2672,97.7431", osm: "R113314" },
	persons    : [ { name: "Ada Host", role: "host", url: "", image: "" } ],
	funding    : [ { url: "https://example.com/support", label: "Support the show" } ],
	value      : { type: "lightning", method: "keysend", suggested: 0.00000005,
	               recipients: [ { name, type, address, split, fee, customKey, customValue } ] },
	liveItems  : [ { status: "live", start, end, id, title, link, enclosures, contentLinks: [ { url, label } ] } ]
}

item.podcast = {
	season      : 2,                                    // 0 when the episode doesn't say
	episode     : 5,
	episodeType : "full",                               // or "trailer", "bonus"
	explicit    : false,
	transcripts : [ { url: "https://example.com/5.vtt", type: "text/vtt" } ],  // all of them, in feed order
	chaptersUrl : "https://example.com/5.chapters.json",
	persons     : [ { name: "Grace Guest", role: "guest", url: "", image: "" } ],
	soundbites  : [ { startTime: 73.5, duration: 60, title: "The best minute" } ],
	location    : { name: "", geo: "", osm: "" },
	value       : { type: "", method: "", suggested: 0, recipients: [] }
}
```

A person's `role` is `"host"` when the feed doesn't give one. `season` and `episode` come from `podcast:season` and `podcast:episode` when the feed has them, else from the iTunes tags. A live item's `start` and `end` are UTC datetimes or null; live items are not in `items`. An item's `persons`, `location` and `value` are its own: when they're empty, the show's apply.

## Dates

ROME reads RFC 822 and ISO 8601 dates. A date in neither is tried against a list of formats seen in real feeds: full day and month names, `2026-11-02 10:00:00` with or without an offset, `November 2, 2026 3:15 PM`, a day alone, C's `asctime`, and a few more. One without a zone is taken as UTC. Anything else is null.

## Repairs

A feed XML parsers refuse is retried without an attribute repeated on its root element (two podcast plugins both declaring `xmlns:itunes`), then without a `<skipHours>` or `<skipDays>` ROME won't accept. A feed whose UTF-8 was encoded twice ("Itâ€™s") has its characters put back; only a document containing C1 control characters, which real text doesn't, is touched.

## Item ids

A reader dedupes on `item.id`, so the rule is fixed:

1. **The feed's own id, trimmed and otherwise untouched**: RSS `<guid>`, Atom `<id>`, RSS 1.0 `rdf:about`, JSON Feed `id`. A blank one counts as missing.
2. Otherwise **the item's link**, resolved against `baseUrl`.
3. With no link either, `"sha256:"` followed by the SHA-256 (lowercase hex) of the title, a newline, the published time as `2026-11-02T15:00:00Z` (or nothing), a newline, and the content.

Rule 2 means two things. Pass the same `baseUrl` every time you parse a feed (`fetchFeed()` does: the address that answered), or the ids of items with relative links will change. And two items without guids that share a link are one item to a reader. An id from rule 3 changes when the publisher edits the item.

Ids are unique within one feed at best, so store them per feed. Some feeds number each edit in the guid (`https://example.com/story#3`); pass `collapseRevisions: true` to keep those one item. Choose once: turning it on later changes the ids of such items.
