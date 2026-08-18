-- Apache-style access log, replacing GoatCounter as the source for
-- /manage/insights. GoatCounter's API calls were made synchronously from
-- request handlers (see GoatCounterClient.bx) and blocked/locked up the app
-- when the API was slow or rate-limited — this table is written to
-- asynchronously by RequestLogger.bx (a background flush loop, never inline
-- with request handling) specifically to avoid that failure mode.
--
-- Deliberately a bigint auto_increment PK, not the varchar(36) uuid() this
-- schema otherwise uses (Post, SearchLog, etc.) — those are domain entities
-- that need globally-unique, non-guessable IDs; this is a high-volume,
-- append-only, naturally time-ordered log, where a narrow integer key is
-- both cheaper to index and simpler to page through.
--
-- status_code is nullable: it depends on Response.bx's getStatusCode(),
-- which doesn't exist yet as of boxlang-express v0.1.17 (the currently
-- pinned version). RequestLogger.bx checks for it at runtime, so this
-- table (and the middleware) work today with status_code left NULL, and
-- start populating it automatically once the pin is bumped to a version
-- that has the getter — no code change needed on this side.
--
-- No migration runner in this project — apply by hand against the live
-- chron database, then update db/schema.sql to match.

CREATE TABLE IF NOT EXISTS RequestLog (
    id           bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
    requested_at timestamp(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    method       varchar(10)     NOT NULL,
    path         varchar(2048)   NOT NULL,
    query_string text            NOT NULL,
    status_code  smallint unsigned NULL,
    duration_ms  int unsigned    NOT NULL,
    ip_address   varchar(45)     NOT NULL DEFAULT '',
    referrer     text            NOT NULL,
    user_agent   text            NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Prefix, not a full index — path is varchar(2048)*utf8mb4, well past
-- InnoDB's 3072-byte max key length; 191 chars (764 bytes) is the standard
-- safe prefix length and plenty to distinguish real paths from each other.
CREATE INDEX idx_request_log_path
    ON RequestLog (path(191));

CREATE INDEX idx_request_log_requested_at
    ON RequestLog (requested_at);
