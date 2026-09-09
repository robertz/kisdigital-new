-- STOMP Chat (routes/StompChat.bx, /chat) removed — unused, nobody was on
-- it. Drops the four tables added in 0010 and 0011.
--
-- No automated migration runner in this project — applied by hand, same as
-- every migration before it.
drop table if exists StompChatDirectMessage;
drop table if exists StompChatMessage;
drop table if exists StompChatChannelMembership;
drop table if exists StompChatChannel;
