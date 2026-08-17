-- Logs every site search so the admin dashboard can surface queries that
-- returned nothing — the clearest signal of content readers want but can't
-- find. See PostService.searchPosts() and Manage.dashboard().

create table SearchLog
(
    id          varchar(36) default (uuid())          not null
        primary key,
    query       varchar(255)                          not null,
    result_count int        default 0                 not null,
    searched_at timestamp   default CURRENT_TIMESTAMP  not null
);

create index idx_search_log_query
    on SearchLog (query);

create index idx_search_log_searched_at
    on SearchLog (searched_at);
