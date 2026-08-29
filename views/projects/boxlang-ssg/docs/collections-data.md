# Collections & Data

The queryable collections every template has access to, and where global JSON data comes from.

## Collections

| Collection | Contents |
|---|---|
| `collections.all` | All templates, except those excluded or acting as a parent pagination template. |
| `collections.post` | All items where `type: post`, sorted by `date` descending. |
| `collections.tags` | Unique list of tags across posts. |
| `collections.byTag[slug]` | Posts grouped by slugified tag. |
| `collections.global` | Nested structure built from JSON files in `_data/`, mirroring that directory's folder structure. |

## Global data (_data/)

Any `.json` file placed under `_data/` is loaded into `collections.global`, with nested directories producing nested keys — so `_data/site/nav.json` ends up at `collections.global.site.nav`. It's a plain way to hand arbitrary structured data (site metadata, a nav menu, a list of authors) to every template without hand-writing a loader for it.
