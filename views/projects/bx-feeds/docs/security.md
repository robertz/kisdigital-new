# Security

What the module protects against, and what is left to you.

## XML attacks

Feeds and OPML files are XML from strangers. The module never reads a DTD: a DOCTYPE at the top of the document is cut out before parsing (old RSS 0.91 feeds carry one, and are still read), and the XML parser is told to refuse any DOCTYPE that remains. So entities a DTD would define don't exist: an external entity (XXE) can't read a file or call a server, an external DTD isn't fetched, and a "billion laughs" entity bomb fails at once instead of expanding. A document that uses such an entity throws `Feeds.ParseError`. The standard HTML entities (`&nbsp;`, `&copy;`...) still work in feeds; ROME replaces them itself. The module's `tests/specs/SecuritySpec.bx` proves each of these against a canary file and a local server.

## HTML is not sanitized

`contentHtml` and `summary` are returned as the feed wrote them, with only relative URLs made absolute. They can contain `<script>`, event handlers, `javascript:` links and tracking pixels. Sanitize them before you show them (that's another module's job). `title`, authors and categories are plain text, which can contain `<` and `&`: escape them on output like any other text.

## URLs are as the feed wrote them, unless you ask

Every URL the module returns (`link`, `image`, enclosures, `podcast.persons[].url`...) is whatever the feed said, resolved. It may be `javascript:` or `file:`. Pass `httpOnly: true` to `parseFeed()` or `fetchFeed()` to have every one that isn't http(s) taken out. OPML addresses are always as written: check them before you subscribe.

## Private addresses

`fetchFeed()` refuses an address that isn't on the public internet: loopback, private and link-local ranges (including cloud metadata at `169.254.169.254`), carrier-grade NAT, reserved ranges, and IPv6 forms that carry or tunnel to one of those. The check is made for the first address and for every redirect. It resolves the host and then connects, relying on the JVM's DNS cache (30 seconds by default) to connect to what it checked; if you've turned that cache off, a hostile DNS server could answer differently the second time, and an egress proxy is the stronger defense.

## WebSub

Anyone who learns a callback address can POST to it. Treat a push as a feed from a stranger: accept it only when `isSigned()` says so, which needs a secret at subscribe time, and parse it with the same care as any other. Give each subscription its own secret and its own unguessable callback.

## Fallback User-Agents

Fallback User-Agents make your fetcher claim to be something it isn't. Sites that block feed readers sometimes mean to; use a fallback for getting feeds a site publishes for the public, not for getting around a block on purpose.

## Limits

`timeoutSeconds` bounds the whole fetch, so a server that trickles bytes can't hold a worker. `maxBytes` is counted after decompression, so a gzip bomb is cut off too. When you parse a document you got some other way, `maxLength` and `maxItems` do the same job for `parseFeed()`.
