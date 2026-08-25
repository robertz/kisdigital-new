-- Nested comments (Reddit-style threading), replacing the giscus embed in
-- views/posts/show.bxm. parent_id (self-referencing, nullable) is a plain
-- adjacency list — a flat query ordered by created, grouped into a tree in
-- BoxLang (CommentService.getCommentTree()) — no materialized path/nested
-- sets needed at this site's comment volume.
--
-- Deletion is always soft (status flag, body left in place but rendered as
-- "[deleted]") so removing a comment never orphans its replies the way a
-- hard delete would. Requires an existing User row to comment at all — see
-- role='commenter' (0007) and AuthService.findOrCreateGoogleUser(), built
-- specifically ahead of this feature.
create table Comment
(
    id        varchar(36)                        default (uuid())          not null
        primary key,
    post_id   varchar(36)                                                  not null,
    parent_id varchar(36)                                                  null,
    user_id   varchar(36)                                                  not null,
    body      text                                                         not null,
    status    enum ('visible', 'deleted')        default 'visible'         not null,
    -- timestamp(3), not plain timestamp — same reasoning as
    -- RequestLog.requested_at (0004_add_request_log.sql): two comments
    -- posted within the same second need a stable creation order, and
    -- second-precision ties resolve arbitrarily.
    created   timestamp(3)                      default CURRENT_TIMESTAMP(3) null,
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
