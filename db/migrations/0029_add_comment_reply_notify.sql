-- A commenter who ticks "Email me when someone replies" gets a random token
-- here (models/services/CommentNotifier.bx). NULL means no reply emails; the
-- unsubscribe link in each email carries the token and clears it.

ALTER TABLE Comment ADD COLUMN reply_notify_token varchar(32) NULL;
