-- bx-activitypub 0.4.x -> 0.5.0 (replying back). Copied verbatim from the
-- module's own sql/upgrade-0.5.0.sql, same convention as 0017/0018/0020.

-- Local replies look up the remote reply they answer by the host's id for it.
ALTER TABLE `ApRemoteObject` ADD KEY `IX_ApRemoteObject_HostId` (`HostId`);
