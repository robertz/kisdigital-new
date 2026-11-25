# OPML

`parseOpml()` and `toOpml()`: reading and writing subscription lists.

## Reading and writing

`parseOpml( input )` reads a subscription list from a string, bytes or a file path. Folders stay nested as they are in the file:

```bxs
list = parseOpml( fileRead( "subscriptions.opml" ) )
// { title: "My feeds", outlines: [
//   { title: "Example", feedUrl: "https://example.com/feed.xml", siteUrl: "https://example.com/", outlines: [] },
//   { title: "News", feedUrl: "", siteUrl: "", outlines: [ { title: "Daily", feedUrl: "https://news.example/rss", ... } ] }
// ] }
```

An outline with a `feedUrl` is a subscription. One without is a folder, and its `outlines` are what's in it. Addresses are returned as written: check they are http(s) before you subscribe to them. An `&` the exporter forgot to escape is read through.

`toOpml( list, title = "" )` writes OPML 2.0 from the same shape, or from just an array of outlines:

```bxs
xml = toOpml( [ { title: "News", outlines: [ { title: "Daily", feedUrl: "https://news.example/rss" } ] } ], "My feeds" )
```
