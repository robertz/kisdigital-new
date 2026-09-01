-- Persists the STOMP Chat channel list itself, channel message history,
-- and direct-message history (routes/StompChat.bx), all with a 30-day
-- rolling retention enforced in application code (StompChat.bx's
-- pruneOldMessages(), run opportunistically after every write — there's
-- no scheduled-job infrastructure in this app to hang a cron-style cleanup
-- off of, and this page's traffic is low enough that "prune on write"
-- costs nothing real).
--
-- #general is still never a row in StompChatChannel, same reasoning as
-- StompChatChannelMembership (0010) not storing it either — it's pinned
-- and always implicitly present, this table only holds channels created
-- on top of it.
create table StompChatChannel
(
    name       varchar(30)                         not null
        primary key,
    created_by varchar(36)                          null,
    created    timestamp default CURRENT_TIMESTAMP  not null,
    constraint StompChatChannel_User_id_fk
        foreign key (created_by) references User (id)
            on update cascade on delete set null
);

-- user_id nullable + ON DELETE SET NULL rather than RESTRICT (unlike
-- Comment.user_id) — a deleted account's old chat messages staying put
-- with an unattributed sender fits this page's throwaway-chat tone better
-- than either blocking the account deletion or cascading the messages
-- away.
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

-- Unlike channel messages, a DM row genuinely belongs to both accounts
-- involved and means nothing without either — ON DELETE CASCADE both
-- ways, matching StompChatChannelMembership's cascade instead of channel
-- messages' set-null.
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

-- Both directions indexed — a conversation is read as "everything between
-- me and partner X, either direction", so either column pair can be the
-- lookup's leading edge depending on which side of a DM the reader is on.
create index idx_stompchatdm_from_to_created
    on StompChatDirectMessage (from_user_id, to_user_id, created);

create index idx_stompchatdm_to_from_created
    on StompChatDirectMessage (to_user_id, from_user_id, created);
