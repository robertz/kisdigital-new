# Configuration

ssg-config.json — output directory, passthrough files, and what to ignore.

## ssg-config.json

```json
{
  "outputDir": "_site",
  "passthru": ["router.bxs", "assets"],
  "ignore": []
}
```

| Key | Meaning |
|---|---|
| `outputDir` | Build output directory — auto-cleaned at the start of every build. |
| `passthru` | Files/directories copied verbatim into `outputDir`, unprocessed. |
| `ignore` | Additional paths to skip entirely when discovering documents. |

`_includes/` is always excluded from document discovery automatically — no need to list it under `ignore`.
