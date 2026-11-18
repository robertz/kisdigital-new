-- WebmentionSendState, as 0027 defines it. 0027 was applied to production by
-- hand before the migrator existed and the migrator never re-runs it, but
-- this table didn't make it, so WebmentionSender failed on every run and no
-- webmentions were sent. Databases that already have it skip this.

create table if not exists WebmentionSendState
(
    post_id      varchar(36)   not null primary key,
    source_url   varchar(512)  not null,
    post_updated timestamp     null,
    links        mediumtext    not null,
    attempts     int           default 0 not null,
    last_run     timestamp     default CURRENT_TIMESTAMP not null
);
