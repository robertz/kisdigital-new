# Pagination

Expanding one template into many output pages, driven from front matter.

## How it works

Add a `pagination` key to a template's front matter with an `alias` and a `data` source (a dotted path to a collection). The template's `permalink` should include `{{alias}}` so it expands to a distinct output path per page. This is exactly how the example `tags.bxm` template builds one page per tag:

```html
<!---
layout: main
view: page
permalink: /tag/{{tag}}.html
pagination:
  alias: tag
  data: collections.tags
--->
```

In the view, the current page's alias value is available as `prc.tag`, and you'd typically use it to look up that tag's posts:

```html
<bx:output>
<bx:loop array="#collections.byTag[ slugify( prc.tag ) ]#" item="post">
  <a href="#post.permalink#">#post.title#</a><br />
</bx:loop>
</bx:output>
```

One template file, one entry per item in `collections.tags` — no manual loop over pages required at the file-system level.
