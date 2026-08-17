-- 2026-08-16 — Trending-by-date
--
-- Adds a daily-bucketed view counter so PostService.getTrendingPosts() can
-- rank by a rolling window (variables.trendingWindowDays in PostService.bx,
-- currently 30) instead of the Views table's all-time total. Views itself is
-- untouched — it still backs the all-time count shown on the post page.
--
-- Applied directly against the live chron database (no migration runner in
-- this project). Re-run is safe — CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS ViewDaily (
    post_id    varchar(36) NOT NULL,
    view_date  date        NOT NULL,
    views      int         NOT NULL DEFAULT 0,
    PRIMARY KEY (post_id, view_date),
    CONSTRAINT ViewDaily_Post_id_fk FOREIGN KEY (post_id) REFERENCES Post (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- One-time backfill from the existing all-time Views table, dated by each
-- post's real last_viewed timestamp (not backdated to today) — so a post
-- that hasn't actually been viewed recently doesn't falsely show as
-- trending just because this migration ran. Safe to re-run: duplicate keys
-- just re-assert the same value.
INSERT INTO ViewDaily (post_id, view_date, views)
SELECT post_id, DATE(COALESCE(last_viewed, CURDATE())), views
FROM Views
ON DUPLICATE KEY UPDATE views = VALUES(views);
