import { Fragment, useMemo, useState, type FormEvent } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ChevronLeft from "@mui/icons-material/ChevronLeft";
import ChevronRight from "@mui/icons-material/ChevronRight";
import { api, errorMessage } from "../../app/api";
import { AdminOnly } from "../../shared/AdminOnly";
import { Page, PageHeader } from "../../shared/Page";
import { formatDateTime } from "../../shared/dates";
import { SystemTabs } from "./SystemTabs";

interface LogRow {
	id: number;
	timeSort: string;
	method: string;
	path: string;
	queryString: string;
	statusCode: number | "";
	durationMs: number;
	ip: string;
	referrer: string;
	userAgent: string;
}

interface LogPage {
	rows: LogRow[];
	hasNewer: boolean;
	hasOlder: boolean;
	newerCursor: number;
	olderCursor: number;
}

type SortKey = "timeSort" | "method" | "path" | "statusCode" | "durationMs" | "ip";

const route = getRouteApi("/logs");
const METHODS = ["GET", "POST", "HEAD", "PUT", "PATCH", "DELETE", "OPTIONS"];
const STATUSES = ["2xx", "3xx", "4xx", "5xx", "unknown"];

// The table is sized by the room it has, not the viewport, because the
// sidebar can be open or collapsed. With plenty of room there are six
// columns; under 900px the IP moves into the row's detail panel; under 680px
// each request becomes a three-line card.
const NARROW = "@container (max-width: 900px)";
const CARDS = "@container (max-width: 680px)";

const tableSx = {
	tableLayout: "fixed",
	"& .log-ip": { [NARROW]: { display: "none" } },
	"& .log-clip": { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
	"& .log-row": { cursor: "pointer" },
	"& .log-row.is-open > td": { bgcolor: "background.raised", borderBottomColor: "transparent" },
	"& .log-detail > td": { bgcolor: "background.raised", pt: 0 },
	[CARDS]: {
		display: "block",
		"& thead": { display: "none" },
		"& tbody": { display: "block" },
		"& .log-row": {
			display: "grid",
			gridTemplateColumns: "auto auto minmax(0, 1fr)",
			gridTemplateAreas: '"method status duration" "path path path" "time time time"',
			alignItems: "center",
			gap: "6px 8px",
			px: 2,
			py: 1.5,
			borderBottom: 1,
			borderColor: "divider",
		},
		"& .log-row.is-open": { bgcolor: "background.raised", borderBottomColor: "transparent" },
		"& .log-row > td": { display: "block", minWidth: 0, p: 0, border: 0, bgcolor: "transparent" },
		"& .log-row > td.log-ip": { display: "none" },
		"& .log-method": { gridArea: "method" },
		"& .log-status": { gridArea: "status" },
		"& .log-duration": { gridArea: "duration", textAlign: "right" },
		"& .log-time": { gridArea: "time", fontSize: "0.75rem" },
		"& .log-path": { gridArea: "path", whiteSpace: "normal", overflowWrap: "anywhere" },
		"& .log-detail, & .log-detail > td": { display: "block" },
	},
} as const;

const methodColor: Record<string, "info" | "success" | "warning" | "error" | "default"> = {
	GET: "info",
	POST: "success",
	PUT: "warning",
	PATCH: "warning",
	DELETE: "error",
};

function statusColor(code: number | ""): "success" | "info" | "warning" | "error" | "default" {
	if (code === "") return "default";
	if (code < 300) return "success";
	if (code < 400) return "info";
	if (code < 500) return "warning";
	return "error";
}

function Detail({ row }: { row: LogRow }) {
	const items: [string, string, boolean][] = [
		["Path", row.path + (row.queryString ? `?${row.queryString}` : ""), true],
		["IP", row.ip || "—", true],
		["Referrer", row.referrer || "—", false],
		["User agent", row.userAgent || "—", false],
	];
	return (
		<Box
			component="dl"
			sx={{
				display: "grid",
				gridTemplateColumns: "max-content minmax(0, 1fr)",
				gap: "8px 16px",
				m: 0,
				fontSize: "0.8125rem",
				[CARDS]: { gridTemplateColumns: "minmax(0, 1fr)", gap: "2px", "& dd": { mb: 1 } },
			}}
		>
			{items.map(([label, value, mono]) => (
				<Fragment key={label}>
					<Typography component="dt" variant="overline" color="text.secondary" sx={{ lineHeight: 1.8 }}>
						{label}
					</Typography>
					<Box component="dd" sx={{ m: 0, overflowWrap: "anywhere", fontFamily: mono ? "var(--font-mono)" : undefined }}>
						{value}
					</Box>
				</Fragment>
			))}
		</Box>
	);
}

function Logs() {
	const search = route.useSearch();
	const navigate = useNavigate();
	const [filters, setFilters] = useState({ q: search.q ?? "", method: search.method ?? "", status: search.status ?? "" });
	const [quick, setQuick] = useState("");
	const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "timeSort", dir: "desc" });
	const [openId, setOpenId] = useState<number | null>(null);

	const params = new URLSearchParams();
	if (search.q) params.set("q", search.q);
	if (search.method) params.set("method", search.method);
	if (search.status) params.set("status", search.status);
	if (search.before) params.set("before", String(search.before));
	if (search.after) params.set("after", String(search.after));
	const queryString = params.toString();

	const logs = useQuery({
		queryKey: ["logs", queryString],
		queryFn: () => api.get<LogPage>(`/manage/api/logs${queryString ? `?${queryString}` : ""}`),
		placeholderData: keepPreviousData,
		staleTime: 0,
	});

	const applied = { q: search.q, method: search.method, status: search.status };
	const hasFilters = Boolean(search.q || search.method || search.status);

	function applyFilters(e: FormEvent) {
		e.preventDefault();
		navigate({
			to: "/logs",
			search: { q: filters.q.trim() || undefined, method: filters.method || undefined, status: filters.status || undefined },
		});
	}

	function clearFilters() {
		setFilters({ q: "", method: "", status: "" });
		navigate({ to: "/logs", search: {} });
	}

	const rows = useMemo(() => {
		const needle = quick.trim().toLowerCase();
		const filtered = (logs.data?.rows ?? []).filter(
			(row) => !needle || `${row.path} ${row.ip} ${row.referrer} ${row.userAgent}`.toLowerCase().includes(needle),
		);
		const dir = sort.dir === "asc" ? 1 : -1;
		return [...filtered].sort((a, b) => {
			const av = sort.key === "statusCode" && a.statusCode === "" ? -1 : a[sort.key];
			const bv = sort.key === "statusCode" && b.statusCode === "" ? -1 : b[sort.key];
			return av < bv ? -dir : av > bv ? dir : 0;
		});
	}, [logs.data, quick, sort]);

	function header(key: SortKey, label: string, width: number | undefined, className?: string) {
		return (
			<TableCell className={className} sx={{ width }} sortDirection={sort.key === key ? sort.dir : false}>
				<TableSortLabel
					active={sort.key === key}
					direction={sort.key === key ? sort.dir : "asc"}
					onClick={() => setSort({ key, dir: sort.key === key && sort.dir === "asc" ? "desc" : "asc" })}
				>
					{label}
				</TableSortLabel>
			</TableCell>
		);
	}

	const data = logs.data;

	return (
		<Page>
			<PageHeader eyebrow="System" title="Request log" subtitle="Every request this server has handled in the last 90 days, newest first." />
			<SystemTabs value="logs" />

			<Box
				component="form"
				onSubmit={applyFilters}
				sx={{
					display: "grid",
					gap: 1.5,
					mb: 2,
					alignItems: "start",
					gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "minmax(0, 1fr) 140px 140px auto auto" },
				}}
			>
				<TextField
					label="Path starts with"
					placeholder="/posts/2026"
					value={filters.q}
					sx={{ gridColumn: { xs: "1 / -1", md: "auto" } }}
					onChange={(e) => setFilters({ ...filters, q: e.target.value })}
				/>
				<TextField select label="Method" value={filters.method} onChange={(e) => setFilters({ ...filters, method: e.target.value })}>
					<MenuItem value="">All</MenuItem>
					{METHODS.map((method) => (
						<MenuItem key={method} value={method}>
							{method}
						</MenuItem>
					))}
				</TextField>
				<TextField select label="Status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
					<MenuItem value="">All</MenuItem>
					{STATUSES.map((status) => (
						<MenuItem key={status} value={status}>
							{status === "unknown" ? "Unknown" : status}
						</MenuItem>
					))}
				</TextField>
				<Button type="submit" variant="contained" sx={{ height: 40, gridColumn: { xs: hasFilters ? "auto" : "1 / -1", md: "auto" } }}>
					Apply
				</Button>
				{hasFilters && (
					<Button color="inherit" sx={{ height: 40 }} onClick={clearFilters}>
						Clear
					</Button>
				)}
			</Box>

			{logs.isError && (
				<Alert severity="error" sx={{ mb: 2 }}>
					{errorMessage(logs.error, "Couldn't load the request log.")}
				</Alert>
			)}
			{logs.isPending && <Skeleton variant="rounded" height={480} />}

			{data && data.rows.length === 0 && (
				<Paper sx={{ p: 6, textAlign: "center" }}>
					<Typography variant="h2">{hasFilters || search.before || search.after ? "No matching requests" : "No requests logged yet"}</Typography>
					<Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
						{hasFilters || search.before || search.after
							? "Nothing logged matches these filters."
							: "Traffic will show up here as soon as this server handles a request."}
					</Typography>
				</Paper>
			)}

			{data && data.rows.length > 0 && (
				<Paper sx={{ overflow: "hidden" }}>
					<Box sx={{ height: 4 }}>{logs.isFetching && <LinearProgress />}</Box>
					<Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ p: 2, alignItems: { md: "center" } }}>
						<TextField
							label="Search this page"
							placeholder="Path, IP, referrer or user agent"
							value={quick}
							sx={{ flex: 1 }}
							onChange={(e) => setQuick(e.target.value)}
						/>
						<Typography variant="caption" color="text.secondary">
							{rows.length} of {data.rows.length} shown. Select a row for its referrer and user agent.
						</Typography>
					</Stack>

					<Box sx={{ containerType: "inline-size" }}>
						<Table size="small" sx={tableSx}>
							<TableHead>
								<TableRow>
									{header("timeSort", "Time", 176)}
									{header("method", "Method", 92)}
									{header("path", "Path", undefined)}
									{header("statusCode", "Status", 88)}
									{header("durationMs", "Duration", 104)}
									{header("ip", "IP", 180, "log-ip")}
								</TableRow>
							</TableHead>
							<TableBody>
								{rows.map((row) => {
									const open = openId === row.id;
									return (
										<Fragment key={row.id}>
											<TableRow
												hover
												className={open ? "log-row is-open" : "log-row"}
												tabIndex={0}
												role="button"
												aria-expanded={open}
												onClick={() => setOpenId(open ? null : row.id)}
												onKeyDown={(e) => {
													if (e.key === "Enter" || e.key === " ") {
														e.preventDefault();
														setOpenId(open ? null : row.id);
													}
												}}
											>
												<TableCell className="log-time log-clip" sx={{ color: "text.secondary", fontFamily: "var(--font-mono)", fontSize: "0.8125rem" }}>
													{formatDateTime(row.timeSort, true)}
												</TableCell>
												<TableCell className="log-method">
													<Chip size="small" variant="outlined" color={methodColor[row.method] ?? "default"} label={row.method} sx={{ height: 22, fontSize: "0.6875rem" }} />
												</TableCell>
												<TableCell className="log-path log-clip" sx={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem" }}>
													{row.path}
													{row.queryString && (
														<Box component="span" sx={{ color: "text.secondary" }}>
															?{row.queryString.length > 40 ? `${row.queryString.slice(0, 40)}…` : row.queryString}
														</Box>
													)}
												</TableCell>
												<TableCell className="log-status">
													<Chip size="small" color={statusColor(row.statusCode)} variant="outlined" label={row.statusCode === "" ? "—" : row.statusCode} sx={{ height: 22 }} />
												</TableCell>
												<TableCell className="log-duration" sx={{ color: "text.secondary", fontFamily: "var(--font-mono)", fontSize: "0.8125rem", whiteSpace: "nowrap" }}>
													{row.durationMs} ms
												</TableCell>
												<TableCell className="log-ip log-clip" sx={{ color: "text.secondary", fontFamily: "var(--font-mono)", fontSize: "0.8125rem" }}>
													{row.ip}
												</TableCell>
											</TableRow>
											{open && (
												<TableRow className="log-detail">
													<TableCell colSpan={6} sx={{ px: 2, pb: 2 }}>
														<Detail row={row} />
													</TableCell>
												</TableRow>
											)}
										</Fragment>
									);
								})}
							</TableBody>
						</Table>
					</Box>

					{rows.length === 0 && (
						<Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: "center" }}>
							No rows on this page match that. This box only searches the rows shown here; use the filters above to search the whole log.
						</Typography>
					)}

					{(data.hasNewer || data.hasOlder) && (
						<Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", px: 2, py: 1.5, borderTop: 1, borderColor: "divider" }}>
							<Button
								startIcon={<ChevronLeft />}
								disabled={!data.hasNewer}
								onClick={() => navigate({ to: "/logs", search: { ...applied, after: data.newerCursor } })}
							>
								Newer
							</Button>
							<Button
								endIcon={<ChevronRight />}
								disabled={!data.hasOlder}
								onClick={() => navigate({ to: "/logs", search: { ...applied, before: data.olderCursor } })}
							>
								Older
							</Button>
						</Stack>
					)}
				</Paper>
			)}
		</Page>
	);
}

export function LogsPage() {
	return (
		<AdminOnly>
			<Logs />
		</AdminOnly>
	);
}
