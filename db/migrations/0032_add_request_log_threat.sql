-- The label ThreatDetector.bx gives a request that looks like an attack or a
-- probe ('secrets', 'wordpress', 'sqli', ...), for /manage/security. ''
-- means it looked ordinary; NULL means it hasn't been checked yet, which is
-- every row logged before this migration until ThreatService.bx's
-- background backfill reaches it.
--
-- Added at the end of the table, so MySQL adds it instantly instead of
-- rebuilding RequestLog. The index answers the Security page's date-range
-- counts from the index alone.

alter table RequestLog
    add column threat varchar(16) null;

create index idx_request_log_requested_threat
    on RequestLog (requested_at, threat);
