-- Webmention (https://www.w3.org/TR/webmention/), received and sent.
--
-- Received: POST /webmention queues a (source, target) pair in Webmention;
-- WebmentionService verifies it in the background (the source page really
-- links to the target) and reads its microformats. Replies and plain mentions
-- with content become comments, the same rows fediverse replies use
-- (remote_* columns, held for approval until the site is trusted); likes,
-- reposts and bookmarks are only counted. A repeat ping for the same pair
-- re-verifies it, and a source that's gone or no longer links is removed.
--
-- remote_source tells the two kinds of remote comment apart: replies under a
-- webmention aren't fediverse threads, so they're neither held for the
-- fediverse approval rule nor sent out as @blog.
--
-- Sent: WebmentionSender records, per post, the links it last notified
-- (WebmentionSendState), so an edit that drops a link still tells that page
-- once, and an unchanged post isn't re-sent.
alter table Comment
    add column remote_source enum ('activitypub', 'webmention') null after user_id;

update Comment set remote_source = 'activitypub' where remote_actor_url is not null;

create table Webmention
(
    id          varchar(36)                                           not null primary key,
    pair_hash   char(64)                                              not null,
    source      varchar(512)                                          not null,
    target      varchar(512)                                          not null,
    post_id     varchar(36)                                           not null,
    status      enum ('queued', 'verified', 'invalid', 'deleted')     default 'queued' not null,
    type        enum ('reply', 'mention', 'like', 'repost', 'bookmark') null,
    author_name varchar(255)                                          null,
    author_url  varchar(512)                                          null,
    comment_id  varchar(36)                                           null,
    error       varchar(255)                                          null,
    attempts    int                                                   default 0 not null,
    received    timestamp(3)                                          default CURRENT_TIMESTAMP(3) not null,
    verified    timestamp(3)                                          null,
    constraint Webmention_pair_hash_uindex unique (pair_hash),
    constraint Webmention_Post_id_fk foreign key (post_id) references Post (id)
        on update cascade on delete cascade
);

create index idx_webmention_status on Webmention (status, received);
create index idx_webmention_post on Webmention (post_id, status, type);

create table WebmentionSendState
(
    post_id      varchar(36)   not null primary key,
    source_url   varchar(512)  not null,
    post_updated timestamp     null,
    links        mediumtext    not null,
    attempts     int           default 0 not null,
    last_run     timestamp     default CURRENT_TIMESTAMP not null
);
