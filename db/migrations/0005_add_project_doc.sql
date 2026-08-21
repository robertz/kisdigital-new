-- Project docs (/projects/:slug/docs/:page), previously raw .bxm template
-- files under views/projects/{slug}/docs/{page}.bxm with the page list
-- hardcoded in routes/Projects.bx — every content edit needed a code change
-- and a deploy. This table backs a new admin editor (/manage/project-docs)
-- instead, the same way Post already does for blog content.
--
-- This app runs on DigitalOcean App Platform with no persistent volume — the
-- container filesystem is wiped on every deploy/restart — so this has to be
-- database-backed rather than writing markdown files to disk.
--
-- varchar(36) uuid() PK, mediumtext body, timestamp/on-update conventions:
-- same as Post. Uniqueness is scoped to (project_slug, page_slug) rather
-- than a single global slug column, since page slugs like "getting-started"
-- legitimately repeat across different projects.
--
-- No migration runner in this project — apply by hand against the live
-- chron database, then update db/schema.sql to match.

CREATE TABLE IF NOT EXISTS ProjectDoc (
    id           varchar(36)  NOT NULL DEFAULT (uuid()) PRIMARY KEY,
    project_slug varchar(100) NOT NULL,
    page_slug    varchar(100) NOT NULL,
    title        varchar(255) NOT NULL,
    body         mediumtext   NOT NULL,
    sort_order   int          NOT NULL DEFAULT 0,
    created      timestamp    NULL DEFAULT CURRENT_TIMESTAMP,
    last_updated timestamp    NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT ProjectDoc_project_page_uindex UNIQUE (project_slug, page_slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
