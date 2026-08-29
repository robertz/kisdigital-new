# Authoring Content

Front matter markers, the common keys every template supports, and worked examples of both file types.

## Two file types, one front matter system

boxlang-ssg reads both `.md` and `.bxm` files. Each file may include YAML front matter to control metadata and output behavior. The marker syntax differs by file type:

| Type | Front matter markers |
|---|---|
| Markdown | Start and end with `---` |
| BoxLang markup | Start with `<!---` and end with `--->` |

## Common front matter keys

| Key | Meaning |
|---|---|
| `title` | Page title |
| `description` | Short description |
| `type` | Content type (e.g. `page`, `post`) — used for view fallback and collections |
| `layout` | Layout file in `_includes/layouts` without extension (defaults to `main`) |
| `view` | View/partial in `_includes/` without extension; falls back to `type` |
| `slug` | Override file slug (used for posts) |
| `tags` | Array of tags; builds `collections.tags` and `collections.byTag` |
| `date` | Date the content refers to |
| `permalink` | Override output path, e.g. `/tag/{{tag}}.html` |
| `fileExt` | Override output extension, e.g. `xml` |
| `published` | Boolean to include/exclude from output |
| `excludeFromCollections` | Boolean to skip the item from collections |

## Example page (index.bxm)

```html
<!---
type: page
layout: main
--->
<bx:output>
<bx:loop array="#collections.post#" item="post">
  <a href="#post.permalink#">#post.title#</a><br />
</bx:loop>
</bx:output>
```

## Example post (posts/example.md)

```markdown
---
layout: main
type: post
slug: my-first-post
title: My First Post
description: A short summary
tags:
- misc
published: true
---

## Hello
This is my first post.
```
