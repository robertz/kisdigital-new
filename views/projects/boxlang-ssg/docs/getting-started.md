# Getting Started

Prerequisites, installing required modules, running your first build, and the project layout.

## Prerequisites

- The BoxLang runtime and CLI (`boxlang` on your PATH)
- Three modules, managed via `requirements.txt`: `bx-jsoup`, `bx-markdown@1.0.0`, `bx-yaml`

## Quick start

Clone and enter the repo:

```bash
git clone https://github.com/robertz/boxlang-ssg.git
cd boxlang-ssg
```

Install the required modules with the helper script, which reads `requirements.txt` and installs what's missing:

```bash
boxlang setup.bx
```

Or install manually:

```bash
install-bx-module bx-jsoup bx-markdown@1.0.0 bx-yaml
```

Then build the site:

```bash
boxlang ssg.bx build
```

Generated files go to `_site/` (configurable — see [Configuration](/projects/boxlang-ssg/docs/configuration)). You can serve `_site/` with any static server. A simple router (`router.bxs`) is also copied into `_site/` for BoxLang's mini server setups.

## Commands

| Command | What it does |
|---|---|
| `boxlang ssg.bx build` | Builds the static site into the configured output folder. |
| `boxlang ssg.bx list` | Lists the discovered renderable documents. |
| `boxlang ssg.bx help` | Shows available commands. |

## Project structure

| Path | What it is |
|---|---|
| `ssg.bx` | CLI entry and build pipeline. |
| `setup.bx` | Installs modules listed in `requirements.txt`. |
| `ssg-config.json` | Build configuration (output dir, passthrough, ignore). |
| `_includes/` | Layouts, views, and partials — `layouts/main.bxm` is the base HTML layout; `page.bxm`, `post.bxm`, `sidebar.bxm` are example views/partials. |
| `_data/` | Optional global JSON data, loaded into `collections.global`. |
| `posts/` | Example content (Markdown with front matter). |
| `assets/` | Static assets (passthrough). |
| `router.bxs` | Simple router included in output for dev serving. |
| `index.bxm` | Example index page showing a posts list. |
| `404.md` | Example 404 page (`layout: none`). |
