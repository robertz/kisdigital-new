-- Backing table for the "persistentCache" cache (boxlang.json) — a
-- JDBCStore-backed BoxLang cache used by InsightsService/PostService's
-- query-result caching and Manage.bx's login rate limiter, so those
-- survive an app restart instead of living in memory only (which the
-- "default" cache still does, and still should — see boxlang.json).
--
-- Created by hand rather than left to the cache's own autoCreate: a second
-- JDBCStore-backed cache's ensureTable() call needs BoxLang's own
-- literally-named "default" cache to already be registered (it runs a
-- queryExecute() internally), and CacheService.onStartup() iterates
-- configured caches in whatever order their backing IStruct's entrySet()
-- happens to produce — not JSON declaration order, confirmed by reading
-- CacheService.class/JDBCStore.class directly. With more than one
-- JDBCStore cache configured, that order isn't reliably "default first"
-- and the app fails to boot. autoCreate: false on "persistentCache" in
-- boxlang.json skips that call entirely (confirmed via
-- JDBCStore.init()'s bytecode: ensureTable() is only invoked when
-- autoCreate is true) — so this table has to already exist.
--
-- Column shape matches the "Sessions" table BoxLang's own JDBCStore
-- autoCreate already produces for sessionCache (never migrated itself,
-- same convention) — objectKey/objectValue/hits/created/lastAccessed/
-- timeout/lastAccessTimeout is the fixed shape JDBCStore expects,
-- not something this app chose.
create table Cache
(
    objectKey          varchar(500)                          not null
        primary key,
    objectValue        longtext,
    hits               bigint       default 0,
    created            timestamp    default CURRENT_TIMESTAMP,
    lastAccessed       timestamp    default CURRENT_TIMESTAMP,
    timeout            bigint       default 0,
    lastAccessTimeout  bigint       default 0
);

create index idx_cache_lastAccessed
    on Cache (lastAccessed);

create index idx_cache_created
    on Cache (created);

create index idx_cache_hits
    on Cache (hits);

create index idx_cache_timeout
    on Cache (timeout, lastAccessTimeout);
