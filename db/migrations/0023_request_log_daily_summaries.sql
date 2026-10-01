-- Makes /manage/insights cheap to load.
--
-- Every Insights card used to scan the last 30 days of RequestLog and run
-- BotDetector's ~30-way user-agent REGEXP against every row, on a cache that
-- expired after 5 minutes, so nearly every visit paid the full cost.
--
-- 1. RequestLogger.bx now classifies each row as it's written (in its
--    background flush thread): is_bot, and the referrer's hostname. Both are
--    NULL on rows logged before this migration; readers fall back to the old
--    expressions for those, which only ever happens while summarizing a day
--    (once, in the background) or for today's rows.
--
-- 2. RequestLogDaily holds one row per (day, kind, name) for completed days:
--    kind 'views' (name '') is the day's visitor page views, 'referrer' is
--    hits per referring host ('' = direct), '404' is hits per missing path.
--    InsightsService.bx builds missing days on a background schedule, and
--    Insights reads ~30 days of these plus today's raw rows. Summaries are
--    never deleted, so they outlive RequestLog's 90-day raw retention.
--
-- No migration runner in this project — apply by hand against the live
-- chron database BEFORE deploying the code that uses these columns, then
-- update db/schema.sql to match. No backfill needed.

ALTER TABLE RequestLog
	ADD COLUMN is_bot        tinyint(1)   NULL AFTER user_agent,
	ADD COLUMN referrer_host varchar(255) NULL AFTER is_bot;

CREATE TABLE IF NOT EXISTS RequestLogDaily (
	log_date  date             NOT NULL,
	kind      varchar(16)      NOT NULL,
	name      varchar(500)     NOT NULL DEFAULT '',
	hits      int unsigned     NOT NULL,
	PRIMARY KEY (log_date, kind, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
