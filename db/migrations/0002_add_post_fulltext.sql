-- 2026-08-16 — Full-text search
--
-- Backs PostService.searchPosts() (MATCH ... AGAINST, natural language mode,
-- relevance-ranked). Applied directly against the live chron database.

ALTER TABLE Post ADD FULLTEXT INDEX idx_post_fulltext (title, description, body);
