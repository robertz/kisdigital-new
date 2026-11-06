-- An hourly record of the running server (models/services/ServerHistory.bx),
-- kept 90 days, for the trend charts on /manage/system. *_hour values are
-- since the previous row, NULL for the first row after a restart. Taken from
-- dt-next's server_metrics.
--
-- The first migration applied at startup by models/util/Migrator.bx.
-- Without the table the System page still shows the live readings, just no
-- charts.

CREATE TABLE IF NOT EXISTS ServerHourly (
	recorded_at        datetime  NOT NULL PRIMARY KEY,
	uptime_seconds     int       NOT NULL,
	heap_used          bigint    NOT NULL,
	heap_max           bigint    NOT NULL,
	old_gen_after_gc   bigint    NULL,
	direct_used        bigint    NULL,
	open_files         int       NULL,
	memory_free        bigint    NULL,
	cpu_load_hour      double    NULL,
	full_gcs_hour      int       NULL,
	gc_ms_hour         int       NULL,
	http_requests_hour int       NULL,
	http_errors_hour   int       NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
