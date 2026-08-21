-- KISDigital — MySQL schema (chron database)
--
-- Reference only: there's no migration runner in this project (the ColdBox
-- app this was ported from didn't have one either), so this file documents
-- the live schema rather than driving it. Apply changes by hand against the
-- database, then update this file and add a note under db/migrations/.

create table Post
(
    id           varchar(36)                             default (uuid())              not null
        primary key,
    title        varchar(255)                                                          not null,
    slug         varchar(255)                                                          not null,
    description  varchar(500)                                                          not null,
    cover_image  varchar(1000)                                                         null,
    body         mediumtext                                                            not null,
    created      timestamp                               default CURRENT_TIMESTAMP     null,
    last_updated timestamp                               default CURRENT_TIMESTAMP     null on update CURRENT_TIMESTAMP,
    publish_date timestamp                               default '1970-01-01 00:00:01' not null,
    status       enum ('draft', 'published', 'archived') default 'draft'               not null,
    featured     tinyint(1)                              default 0                     not null,
    constraint Post_slug_publish_date_uindex
        unique (slug, publish_date)
);

create index idx_post_featured_status
    on Post (featured, status);

-- Backs PostService.searchPosts() (see db/migrations/0002_add_post_fulltext.sql)
create fulltext index idx_post_fulltext
    on Post (title, description, body);

create table Settings
(
    category      varchar(50) default 'general'         not null,
    setting_key   varchar(100)                          not null,
    setting_value text                                  not null,
    setting_type  varchar(20) default 'string'          null,
    description   varchar(255)                          null,
    updated_at    timestamp   default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    primary key (category, setting_key)
);

create table Tag
(
    id  varchar(36) default (uuid()) not null
        primary key,
    tag varchar(50)                  not null,
    constraint Tag_tag_uindex
        unique (tag)
);

create table TagPost
(
    tag_id  varchar(36) not null,
    post_id varchar(36) not null,
    primary key (tag_id, post_id),
    constraint TagPost_Post_id_fk
        foreign key (post_id) references Post (id)
            on update cascade on delete cascade,
    constraint TagPost_Tag_id_fk
        foreign key (tag_id) references Tag (id)
);

create table User
(
    id           varchar(36)              default (uuid())          not null
        primary key,
    display_name varchar(50)                                        not null,
    email        varchar(255)                                       not null,
    password     varchar(1000)                                      not null,
    role         enum ('author', 'admin') default 'author'          not null,
    about        varchar(500)                                       null,
    avatar_label varchar(2)                                         null,
    is_active    tinyint(1)               default 1                 not null,
    created      timestamp                default CURRENT_TIMESTAMP null,
    constraint User_email_uindex
        unique (email)
);

create index idx_user_is_active
    on User (is_active);

create table UserPost
(
    user_id     varchar(36)                                             not null,
    post_id     varchar(36)                                             not null,
    author_role enum ('author', 'co-author', 'editor') default 'author' not null,
    primary key (user_id, post_id),
    constraint UserPost_Post_id_fk
        foreign key (post_id) references Post (id)
            on update cascade on delete cascade,
    constraint UserPost_User_id_fk
        foreign key (user_id) references User (id)
);

create table Views
(
    post_id     varchar(36)                         not null
        primary key,
    views       int       default 0                 not null,
    last_viewed timestamp default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    constraint Views_Post_id_fk
        foreign key (post_id) references Post (id)
            on delete cascade
);

-- Daily-bucketed view counts, added for trending-by-recency (see
-- db/migrations/0001_add_view_daily.sql). Views above stays the all-time
-- counter shown on the post page itself; this backs
-- PostService.getTrendingPosts()'s rolling window.
create table ViewDaily
(
    post_id   varchar(36) not null,
    view_date date        not null,
    views     int         default 0 not null,
    primary key (post_id, view_date),
    constraint ViewDaily_Post_id_fk
        foreign key (post_id) references Post (id)
            on delete cascade
);

-- Every site search, including result count — backs the dashboard's
-- zero-result-query card (see db/migrations/0003_add_search_log.sql).
create table SearchLog
(
    id           varchar(36) default (uuid())         not null
        primary key,
    query        varchar(255)                         not null,
    result_count int         default 0                not null,
    searched_at  timestamp   default CURRENT_TIMESTAMP not null
);

create index idx_search_log_query
    on SearchLog (query);

create index idx_search_log_searched_at
    on SearchLog (searched_at);

-- Apache-style access log, written to asynchronously by RequestLogger.bx —
-- replaces GoatCounter as the source for /manage/insights (see
-- db/migrations/0004_add_request_log.sql for why: GoatCounter's synchronous,
-- rate-limited API calls could lock up request handling).
create table RequestLog
(
    id           bigint unsigned auto_increment          not null
        primary key,
    requested_at timestamp(3) default CURRENT_TIMESTAMP(3) not null,
    method       varchar(10)                              not null,
    path         varchar(2048)                            not null,
    query_string text                                     not null,
    status_code  smallint unsigned                        null,
    duration_ms  int unsigned                             not null,
    ip_address   varchar(45) default ''                   not null,
    referrer     text                                     not null,
    user_agent   text                                     not null
);

create index idx_request_log_path
    on RequestLog (path(191));

create index idx_request_log_requested_at
    on RequestLog (requested_at);

-- Project docs (/projects/:slug/docs/:page), editable via /manage/project-docs
-- instead of hand-edited .bxm template files + a deploy per change (see
-- db/migrations/0005_add_project_doc.sql).
create table ProjectDoc
(
    id           varchar(36)   default (uuid())         not null
        primary key,
    project_slug varchar(100)                            not null,
    page_slug    varchar(100)                            not null,
    title        varchar(255)                            not null,
    body         mediumtext                               not null,
    sort_order   int           default 0                 not null,
    created      timestamp     default CURRENT_TIMESTAMP null,
    last_updated timestamp     default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    constraint ProjectDoc_project_page_uindex
        unique (project_slug, page_slug)
);
