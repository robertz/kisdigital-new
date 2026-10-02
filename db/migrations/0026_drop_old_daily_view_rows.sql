-- Page views are now counted more narrowly (pages that loaded, not every
-- visitor request) and stored in RequestLogDaily under kind 'pageviews',
-- which InsightsService rebuilds by itself from RequestLog. The old 'views'
-- rows are no longer read; this only clears them out. Optional, and safe to
-- run at any time after the deploy.
DELETE FROM RequestLogDaily WHERE kind = 'views';
