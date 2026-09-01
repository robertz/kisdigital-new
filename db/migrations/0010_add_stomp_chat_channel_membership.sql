-- Persists which STOMP Chat channels a user has explicitly joined
-- (routes/StompChat.bx), so channel membership survives a redeploy the way
-- the rest of that page's state (channels themselves, message history,
-- presence) deliberately doesn't. #general is never stored here — every
-- user is always considered a member of it (pinned, can't be left), so a
-- row only ever exists for a channel someone joined on top of that.
--
-- No foreign key to a StompChat "Channel" table because there isn't one —
-- variables.channels in StompChat.bx is still a plain in-memory array that
-- resets on deploy. A membership row can outlive the channel it names (the
-- channel just won't exist in memory anymore); StompChat.bx filters
-- joinedChannelsFor() against the live in-memory channel list rather than
-- assuming every stored row still refers to something real.
create table StompChatChannelMembership
(
    user_id varchar(36)                        not null,
    channel varchar(30)                        not null,
    joined  timestamp default CURRENT_TIMESTAMP not null,
    primary key (user_id, channel),
    constraint StompChatChannelMembership_User_id_fk
        foreign key (user_id) references User (id)
            on update cascade on delete cascade
);
