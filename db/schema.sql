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

-- role='commenter' (0007) is a Google-only account tier with no /manage
-- access, created by AuthService.findOrCreateGoogleUser() for anyone
-- signing in whose email doesn't match an existing author/admin row —
-- built as groundwork for the Comment table below. avatar_url (0008) is
-- that same Google account's profile photo, synced on every login.
create table User
(
    id           varchar(36)                          default (uuid())          not null
        primary key,
    display_name varchar(50)                                                    not null,
    email        varchar(255)                                                   not null,
    password     varchar(1000)                                                  not null,
    role         enum ('author', 'admin', 'commenter') default 'author'         not null,
    about        varchar(500)                                                   null,
    avatar_label varchar(2)                                                     null,
    avatar_url   varchar(500)                                                   null,
    is_active    tinyint(1)                           default 1                 not null,
    created      timestamp                            default CURRENT_TIMESTAMP null,
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

-- Nested comments (see db/migrations/0009_add_comment_table.sql) — replaces
-- the giscus embed formerly in views/posts/show.bxm. parent_id (nullable,
-- self-referencing) is a plain adjacency list: queried flat, ordered by
-- created, grouped into a tree in CommentService.getCommentTree(). Deletion
-- is always soft (status flag) so removing a comment never orphans its
-- replies.
create table Comment
(
    id        varchar(36)                  default (uuid())          not null
        primary key,
    post_id   varchar(36)                                             not null,
    parent_id varchar(36)                                             null,
    user_id   varchar(36)                                             not null,
    body      text                                                    not null,
    status    enum ('visible', 'deleted')  default 'visible'          not null,
    created   timestamp(3)                 default CURRENT_TIMESTAMP(3) null,
    constraint Comment_Post_id_fk
        foreign key (post_id) references Post (id)
            on update cascade on delete cascade,
    constraint Comment_Parent_id_fk
        foreign key (parent_id) references Comment (id)
            on update cascade on delete cascade,
    constraint Comment_User_id_fk
        foreign key (user_id) references User (id)
);

create index idx_comment_post
    on Comment (post_id, created);

create index idx_comment_parent
    on Comment (parent_id);

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

-- STOMP Chat (/games/stomp-chat) channel membership — see
-- db/migrations/0010_add_stomp_chat_channel_membership.sql for why #general
-- itself is never a row here.
create table StompChatChannelMembership
(
    user_id varchar(36)                          not null,
    channel varchar(30)                          not null,
    joined  timestamp default CURRENT_TIMESTAMP  not null,
    primary key (user_id, channel),
    constraint StompChatChannelMembership_User_id_fk
        foreign key (user_id) references User (id)
            on update cascade on delete cascade
);

-- STOMP Chat channel list, channel history, and DM history — 30-day
-- rolling retention enforced in app code, see
-- db/migrations/0011_add_stomp_chat_history.sql.
create table StompChatChannel
(
    name       varchar(30)                          not null
        primary key,
    created_by varchar(36)                          null,
    created    timestamp default CURRENT_TIMESTAMP  not null,
    constraint StompChatChannel_User_id_fk
        foreign key (created_by) references User (id)
            on update cascade on delete set null
);

create table StompChatMessage
(
    id        varchar(36)   default (uuid())            not null
        primary key,
    channel   varchar(30)                                not null,
    user_id   varchar(36)                                 null,
    from_name varchar(50)                                not null,
    body      varchar(1000)                              not null,
    created   timestamp(3)  default CURRENT_TIMESTAMP(3) not null,
    constraint StompChatMessage_User_id_fk
        foreign key (user_id) references User (id)
            on update cascade on delete set null
);

create index idx_stompchatmessage_channel_created
    on StompChatMessage (channel, created);

create table StompChatDirectMessage
(
    id           varchar(36)   default (uuid())            not null
        primary key,
    from_user_id varchar(36)                                not null,
    to_user_id   varchar(36)                                not null,
    from_name    varchar(50)                                not null,
    body         varchar(1000)                              not null,
    created      timestamp(3)  default CURRENT_TIMESTAMP(3) not null,
    constraint StompChatDirectMessage_From_User_id_fk
        foreign key (from_user_id) references User (id)
            on update cascade on delete cascade,
    constraint StompChatDirectMessage_To_User_id_fk
        foreign key (to_user_id) references User (id)
            on update cascade on delete cascade
);

create index idx_stompchatdm_from_to_created
    on StompChatDirectMessage (from_user_id, to_user_id, created);

create index idx_stompchatdm_to_from_created
    on StompChatDirectMessage (to_user_id, from_user_id, created);

-- Stellar Dominion (/games/empire) — see
-- db/migrations/0012_add_stellar_dominion.sql for why military stays flat
-- count columns in v1, and 0013_add_stellar_dominion_planets.sql for why
-- planets (unlike military) became real rows instead.
create table Empire
(
    id              varchar(36)  default (uuid())           not null
        primary key,
    user_id         varchar(36)                              not null,
    name            varchar(50)                              not null,
    credits         bigint       default 1000                not null,
    food            bigint       default 500                 not null,
    fuel            bigint       default 500                 not null,
    population      bigint       default 100                 not null,
    soldiers        int          default 10                  not null,
    fighters        int          default 5                   not null,
    cruisers        int          default 0                   not null,
    turns_remaining int          default 20                  not null,
    last_turn_reset date         default (curdate())         not null,
    shielded_until  timestamp                                 null,
    created         timestamp    default CURRENT_TIMESTAMP   not null,
    updated         timestamp    default CURRENT_TIMESTAMP   not null on update CURRENT_TIMESTAMP,
    constraint Empire_user_id_uindex
        unique (user_id),
    constraint Empire_User_id_fk
        foreign key (user_id) references User (id)
            on update cascade on delete cascade
);

-- One row per planet a user owns; type drives its passive per-turn yield
-- and its net-worth value (see EmpireService.bx's PLANET_YIELDS/
-- PLANET_VALUES constants). Ownership transfers on a successful attack's
-- rare capture roll by updating empire_id, not by deleting/recreating a row.
create table Planet
(
    id        varchar(36)  default (uuid())                 not null
        primary key,
    empire_id varchar(36)                                    not null,
    type      enum ('agricultural', 'mining', 'industrial')  not null,
    created   timestamp    default CURRENT_TIMESTAMP         not null,
    constraint Planet_Empire_id_fk
        foreign key (empire_id) references Empire (id)
            on update cascade on delete cascade
);

create index idx_planet_empire
    on Planet (empire_id);

create table EmpireBattle
(
    id                          varchar(36) default (uuid())          not null
        primary key,
    attacker_empire_id          varchar(36)                            not null,
    defender_empire_id          varchar(36)                            not null,
    outcome                     enum ('attacker_win', 'defender_win')  not null,
    credits_plundered           bigint      default 0                 not null,
    food_plundered              bigint      default 0                 not null,
    fuel_plundered              bigint      default 0                 not null,
    planet_captured             tinyint(1)  default 0                 not null,
    attacker_committed_soldiers int         default 0                 not null,
    attacker_committed_fighters int         default 0                 not null,
    attacker_committed_cruisers int         default 0                 not null,
    attacker_power              decimal(10,2)                         not null,
    defender_power              decimal(10,2)                         not null,
    win_probability             decimal(5,4)                          not null,
    created                     timestamp   default CURRENT_TIMESTAMP not null,
    constraint EmpireBattle_Attacker_Empire_id_fk
        foreign key (attacker_empire_id) references Empire (id)
            on update cascade on delete cascade,
    constraint EmpireBattle_Defender_Empire_id_fk
        foreign key (defender_empire_id) references Empire (id)
            on update cascade on delete cascade
);

create index idx_empirebattle_defender_created
    on EmpireBattle (defender_empire_id, created);

create index idx_empirebattle_attacker_created
    on EmpireBattle (attacker_empire_id, created);
