-- Email subscriptions to new posts (models/services/SubscriptionService.bx).
--
-- Subscriber: double opt-in. An address starts 'pending' with a confirm_token
-- that the confirmation email carries; confirming clears it and makes the row
-- 'active'. unsubscribe_token is in every post email and never changes.
-- 'bounced' and 'complained' come from SES's notifications (routes/
-- Subscriptions.bx) and are never emailed again.
--
-- PostEmail: one row per post that has been (or is being) emailed.
-- PostEmailDelivery records each address a post was sent to, so a restart
-- part way through a send carries on rather than starting over.
--
-- Every post already public is recorded as sent, so turning this on doesn't
-- email the archive.
create table Subscriber
(
    id                varchar(36)                                                         not null primary key,
    email             varchar(255)                                                        not null,
    status            enum ('pending', 'active', 'unsubscribed', 'bounced', 'complained') default 'pending' not null,
    confirm_token     char(32)                                                            null,
    unsubscribe_token char(32)                                                            not null,
    created           timestamp                                                           default CURRENT_TIMESTAMP not null,
    confirm_sent      timestamp                                                           null,
    confirmed         timestamp                                                           null,
    updated           timestamp                                                           default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP,
    constraint Subscriber_email_uindex unique (email)
);

create index idx_subscriber_status on Subscriber (status, confirmed);

create table PostEmail
(
    post_id  varchar(36) not null primary key,
    queued   timestamp   default CURRENT_TIMESTAMP not null,
    finished timestamp   null,
    sent     int         default 0 not null
);

create table PostEmailDelivery
(
    post_id       varchar(36) not null,
    subscriber_id varchar(36) not null,
    sent          timestamp   default CURRENT_TIMESTAMP not null,
    primary key (post_id, subscriber_id)
);

insert ignore into PostEmail (post_id, queued, finished)
select id, NOW(), NOW() from Post where status = 'published' and publish_date <= NOW();
