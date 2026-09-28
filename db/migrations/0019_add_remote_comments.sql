-- Replies from the fediverse (bx-activitypub 0.2.0) become comments. A remote
-- comment has no User: user_id is NULL and the remote_* columns describe its
-- author. Its body is HTML sanitized at import (CommentService.
-- sanitizeRemoteHtml()), unlike local comments, which stay plain text.
--
-- 'pending' holds a remote reply for approval in /manage/comments until its
-- author has at least one approved (visible) remote comment; after that their
-- replies publish immediately (trust is derived from these rows, no separate
-- table).
alter table Comment
    modify user_id varchar(36) null,
    modify status enum ('visible', 'deleted', 'pending') default 'visible' not null,
    add column remote_actor_url        varchar(512) null after user_id,
    add column remote_name             varchar(255) null after remote_actor_url,
    add column remote_handle           varchar(255) null after remote_name,
    add column remote_profile_url      varchar(512) null after remote_handle,
    add column remote_object_url       varchar(512) null after remote_profile_url,
    add column remote_url              varchar(512) null after remote_object_url,
    add column remote_summary          varchar(500) null after remote_url,
    add column remote_sensitive        tinyint(1)   default 0 not null after remote_summary,
    add column remote_attachment_count int          default 0 not null after remote_sensitive,
    add constraint Comment_remote_object_url_uindex unique (remote_object_url),
    add index idx_comment_remote_actor (remote_actor_url, status);
