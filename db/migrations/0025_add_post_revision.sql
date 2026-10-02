-- Revision history for posts, behind the History panel in the /manage post
-- editor (models/services/RevisionService.bx).
--
-- kind = 'save'     — a snapshot taken each time a post is saved. The most
--                     recent 30 per post are kept.
-- kind = 'autosave' — the editor's unsaved work in progress, sent every
--                     minute while there are unsaved changes. One per post
--                     per user, replaced each time and removed on save. It
--                     never changes the post itself.
--
-- The app treats this table as optional: until it exists, saving works as
-- before and the History panel says it isn't available.
create table PostRevision
(
    id          bigint auto_increment
        primary key,
    post_id     varchar(36)                               not null,
    user_id     varchar(36)                               null,
    kind        enum ('save', 'autosave') default 'save'  not null,
    title       varchar(255)                              not null,
    description varchar(500)                              not null,
    cover_image varchar(1000)                             null,
    body        mediumtext                                not null,
    tags        varchar(1000)             default ''      not null,
    created     timestamp default CURRENT_TIMESTAMP       not null,
    constraint PostRevision_Post_id_fk
        foreign key (post_id) references Post (id)
            on update cascade on delete cascade
);

create index idx_postrevision_post_created
    on PostRevision (post_id, created);
