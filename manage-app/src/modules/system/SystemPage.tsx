import { useState, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Refresh from "@mui/icons-material/Refresh";
import { api, errorMessage } from "../../app/api";
import { AdminOnly } from "../../shared/AdminOnly";
import { Card } from "../../shared/cards";
import { Page, PageHeader } from "../../shared/Page";
import { SystemTabs } from "./SystemTabs";
import { TimeChart, type TimePoint } from "./TimeChart";

type Maybe<T> = T | null | undefined;

interface Snapshot {
	boxlangVersion: string;
	memory: {
		heapUsed: number;
		heapCommitted: number;
		heapMax: number;
		nonHeapUsed: number;
		nonHeapCommitted: number;
		oldGenAfterLastGc?: number | null;
		pools: { name: string; used: number; committed: number; usedAfterLastGc?: number | null }[];
		direct?: { buffers: number; used: number; max?: number | null } | null;
	};
	cpu: {
		availableProcessors: number;
		systemLoadAverage: number;
		processCpuLoad?: number;
		systemCpuLoad?: number;
		averageLoad?: number;
		recentLoad?: number;
		recentSeconds?: number;
		totalPhysicalMemory?: number;
		freePhysicalMemory?: number;
		totalSwap?: number;
		freeSwap?: number;
	};
	disk: { totalSpace: number; freeSpace: number; usableSpace: number };
	jvm: {
		vmName: string;
		vmVendor: string;
		vmVersion: string;
		startedAt: string;
		uptimeMs: number;
		loadedClassCount: number;
		jvmArguments: string[];
	};
	gc: { name: string; collectionCount: number; collectionTime: number }[];
	gcHealth: { ratio: number; status: string; label: string };
	fullGcCauses: { cause: string; collections: number; timeMs: number }[];
	threads: {
		liveCount: number;
		peakCount: number;
		daemonCount: number;
		totalStartedCount: number;
		deadlocked: string[];
		busiest: { name: string; state: string; cpuSeconds: number; recentLoad?: number | null }[];
	};
	files?: { open: number; max?: number } | null;
	process: { pid?: number; osName: string; osVersion: string; osArch: string; javaVersion: string; userDir: string };
	connector?: {
		requestCount: number;
		activeRequests: number;
		maxActiveRequests: number;
		activeConnections: number;
		maxActiveConnections: number;
		bytesSent: number;
		bytesReceived: number;
		errorCount: number;
	} | null;
	requestTiming?: { requests: number; averageMs: number; slowestMs: number } | null;
	mysql?: {
		version: string;
		uptimeSeconds: number;
		bufferPoolBytes: number;
		bufferPoolDataBytes: number;
		hitRate?: number | null;
		recentHitRate?: number | null;
		queries: number;
		slowQueries: number;
		longQuerySeconds: number;
		threadsConnected: number;
		threadsRunning: number;
		maxConnections: number;
		tmpTables: number;
		tmpDiskTables: number;
		tables: { name: string; rows: number; dataBytes: number; indexBytes: number }[];
	} | null;
}

interface HourRecord {
	recordedAt: string;
	heapMax: number;
	oldGenAfterGc: number | null;
	cpuLoadHour: number | null;
	fullGcsHour: number | null;
	httpRequestsHour: number | null;
	httpErrorsHour: number | null;
}

const REFRESH_MS = 30_000;

const RANGES = [
	{ hours: 24, label: "24 hours" },
	{ hours: 48, label: "2 days" },
	{ hours: 24 * 7, label: "7 days" },
	{ hours: 24 * 30, label: "30 days" },
];

const bytes = (n: Maybe<number>) => {
	if (n === null || n === undefined || n < 0) return "—";
	if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
	if (n >= 1024 ** 2) return `${Math.round(n / 1024 ** 2)} MB`;
	if (n >= 1024) return `${Math.round(n / 1024)} KB`;
	return `${n} B`;
};
const percent = (f: Maybe<number>, digits = 0) => (f === null || f === undefined || f < 0 ? "—" : `${(f * 100).toFixed(digits)}%`);
const count = (n: Maybe<number>) => (n === null || n === undefined ? "—" : Math.round(n).toLocaleString());
const ms = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)} s` : n < 10 ? `${n.toFixed(1)} ms` : `${Math.round(n)} ms`);
const duration = (seconds: number) => {
	const d = Math.floor(seconds / 86400);
	const h = Math.floor((seconds % 86400) / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
};
const ago = (time: number) => {
	const seconds = Math.max(0, Math.round((Date.now() - time) / 1000));
	return seconds < 5 ? "just now" : seconds < 60 ? `${seconds}s ago` : `${Math.round(seconds / 60)}m ago`;
};

const gcColor: Record<string, "success" | "info" | "warning" | "error"> = {
	healthy: "success",
	watch: "info",
	investigate: "warning",
	problem: "error",
};

function Server() {
	const [hours, setHours] = useState(48);
	const query = useQuery({
		queryKey: ["system", hours],
		queryFn: () => api.get<{ server: Snapshot; history: HourRecord[] | null }>(`/manage/api/system?hours=${hours}`),
		refetchInterval: REFRESH_MS,
		staleTime: 0,
		placeholderData: keepPreviousData,
	});
	const data = query.data;

	return (
		<Page>
			<PageHeader
				eyebrow="System"
				title="Server"
				subtitle={'This process now, read every 30 seconds, and its hourly record over time. "Disk" is this container\'s own filesystem, not the host\'s.'}
				actions={
					data && (
						<Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
							<Typography variant="caption" color={query.isError ? "error" : "text.secondary"} aria-live="polite">
								{query.isError ? "Updates paused" : query.isFetching ? "Reading…" : `Read ${ago(query.dataUpdatedAt)}`}
							</Typography>
							<Button size="small" variant="outlined" startIcon={<Refresh />} disabled={query.isFetching} onClick={() => void query.refetch()}>
								Refresh
							</Button>
						</Stack>
					)
				}
			/>
			<SystemTabs value="server" />

			{query.isPending && <Skeleton variant="rounded" height={480} />}
			{query.isError && !data && <Alert severity="error">{errorMessage(query.error, "Couldn't load server metrics.")}</Alert>}

			{data && (
				<Stack spacing={3}>
					<Tiles s={data.server} />

					<Box>
						<Stack direction="row" spacing={2} useFlexGap sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", mb: 1.5 }}>
							<Typography variant="h2">Over time</Typography>
							<ToggleButtonGroup size="small" exclusive value={hours} onChange={(_e, next: number | null) => next && setHours(next)} aria-label="Range">
								{RANGES.map((r) => (
									<ToggleButton key={r.hours} value={r.hours} sx={{ px: 1.5, py: 0.25, textTransform: "none" }}>
										{r.label}
									</ToggleButton>
								))}
							</ToggleButtonGroup>
						</Stack>
						{data.history === null ? (
							<Alert severity="info">
								Hourly records need the ServerHourly table. Apply db/migrations/0028_add_server_hourly.sql to start keeping them.
							</Alert>
						) : (
							<Charts history={data.history} />
						)}
					</Box>

					{/* Columns rather than a grid: each card sits right under the one
					    above, so a short card doesn't leave a gap beside a tall one. */}
					<Box
						sx={{
							columnCount: { xs: 1, md: 2, xl: 3 },
							columnGap: (theme) => theme.spacing(3),
							"& > *": { breakInside: "avoid", mb: 3 },
							mb: -3,
						}}
					>
						<Memory s={data.server} />
						<Cpu s={data.server} />
						<Collection s={data.server} />
						<Threads s={data.server} />
						<Http s={data.server} />
						<Runtime s={data.server} />
						<Mysql s={data.server} />
					</Box>

					{data.server.mysql && <LargestTables tables={data.server.mysql.tables} />}
				</Stack>
			)}
		</Page>
	);
}

function Tiles({ s }: { s: Snapshot }) {
	const heapMax = s.memory.heapMax > 0 ? s.memory.heapMax : s.memory.heapCommitted;
	const diskUsed = s.disk.totalSpace - s.disk.freeSpace;
	const deadlocked = s.threads.deadlocked.length > 0;
	const cpu = s.cpu.recentLoad ?? s.cpu.averageLoad;
	const tiles: { label: string; value: ReactNode; note?: ReactNode; bar?: number; warn?: boolean }[] = [
		{ label: "Up", value: duration(s.jvm.uptimeMs / 1000), note: `since ${new Date(s.jvm.startedAt).toLocaleString()}` },
		{ label: "Heap", value: bytes(s.memory.heapUsed), note: `of ${bytes(heapMax)}`, bar: s.memory.heapUsed / heapMax },
		{ label: "After last full GC", value: bytes(s.memory.oldGenAfterLastGc), note: "what collection can't free" },
		{
			label: "CPU",
			value: percent(cpu),
			note:
				s.cpu.recentLoad !== undefined
					? `last ${s.cpu.recentSeconds}s of ${s.cpu.availableProcessors} CPUs`
					: `average, ${s.cpu.availableProcessors} CPUs`,
		},
		{
			label: "Requests",
			value: count(s.connector?.requestCount),
			note: s.connector ? `${count(s.connector.errorCount)} errors · ${s.connector.activeRequests} now` : "not listening",
		},
		{ label: "Threads", value: count(s.threads.liveCount), note: deadlocked ? `${s.threads.deadlocked.length} deadlocked` : `peak ${s.threads.peakCount}`, warn: deadlocked },
		{ label: "Open files", value: count(s.files?.open), note: s.files?.max ? `of ${count(s.files.max)}` : undefined },
		{ label: "Disk", value: bytes(s.disk.usableSpace), note: `free of ${bytes(s.disk.totalSpace)}`, bar: diskUsed / s.disk.totalSpace },
	];
	return (
		<Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" } }}>
			{tiles.map((tile) => (
				<Paper key={tile.label} sx={{ p: 2, minWidth: 0, borderColor: tile.warn ? "error.main" : undefined }}>
					<Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
						{tile.label}
					</Typography>
					<Typography sx={{ fontSize: "1.375rem", fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1.3, color: tile.warn ? "error.main" : undefined }}>
						{tile.value}
					</Typography>
					{tile.note && (
						<Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }} title={typeof tile.note === "string" ? tile.note : undefined}>
							{tile.note}
						</Typography>
					)}
					{tile.bar !== undefined && <UsageBar fraction={tile.bar} />}
				</Paper>
			))}
		</Box>
	);
}

function UsageBar({ fraction }: { fraction: number }) {
	const value = Math.min(100, Math.max(0, fraction * 100));
	const color = value >= 90 ? "error" : value >= 75 ? "warning" : "primary";
	return <LinearProgress variant="determinate" color={color} value={value} sx={{ mt: 1, height: 6, borderRadius: 3 }} />;
}

function Charts({ history }: { history: HourRecord[] }) {
	// An hour with no reading comes back as "" (the first after a restart).
	const series = (pick: (r: HourRecord) => number | null): TimePoint[] =>
		history.map((r) => {
			const v = pick(r);
			return { t: r.recordedAt, v: typeof v === "number" ? v : null };
		});
	const heapMax = history.length ? Number(history[history.length - 1].heapMax) || undefined : undefined;
	return (
		<Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" } }}>
			<TimeChart
				wide
				title="Memory in use after garbage collection"
				points={series((r) => r.oldGenAfterGc)}
				format={bytes}
				reference={heapMax ? { value: heapMax, label: "heap cap" } : undefined}
			/>
			<TimeChart title="CPU load (per hour)" points={series((r) => r.cpuLoadHour)} format={(v) => percent(v, v < 0.1 ? 1 : 0)} />
			<TimeChart title="Requests per hour" kind="bar" whole points={series((r) => r.httpRequestsHour)} format={count} />
			<TimeChart title="Server errors per hour" kind="bar" whole points={series((r) => r.httpErrorsHour)} format={count} />
			<TimeChart title="Full garbage collections per hour" kind="bar" whole points={series((r) => r.fullGcsHour)} format={count} />
		</Box>
	);
}

/** A titled card of label · value rows. */
function Facts({ title, action, rows, children }: { title: string; action?: ReactNode; rows: [string, ReactNode][]; children?: ReactNode }) {
	return (
		<Card title={title} action={action}>
			<Box component="dl" sx={{ m: 0 }}>
				{rows.map(([label, value], index) => (
					<Stack
						key={`${label}-${index}`}
						direction="row"
						spacing={2}
						sx={{ justifyContent: "space-between", py: 0.75, borderTop: index ? 1 : 0, borderColor: "divider" }}
					>
						<Typography component="dt" variant="body2" color="text.secondary" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
							{label}
						</Typography>
						<Typography component="dd" variant="body2" sx={{ m: 0, fontWeight: 600, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
							{value}
						</Typography>
					</Stack>
				))}
			</Box>
			{children}
		</Card>
	);
}

function Memory({ s }: { s: Snapshot }) {
	const m = s.memory;
	return (
		<Facts
			title="Memory"
			rows={[
				["Heap committed", bytes(m.heapCommitted)],
				["Outside the heap", `${bytes(m.nonHeapUsed)} (${bytes(m.nonHeapCommitted)} committed)`],
				["Direct buffers", m.direct ? `${bytes(m.direct.used)} in ${count(m.direct.buffers)}${m.direct.max ? ` of ${bytes(m.direct.max)}` : ""}` : "—"],
				...m.pools.map((p): [string, ReactNode] => [p.name, `${bytes(p.used)}${p.usedAfterLastGc != null ? ` · ${bytes(p.usedAfterLastGc)} after GC` : ""}`]),
			]}
		/>
	);
}

function Cpu({ s }: { s: Snapshot }) {
	const c = s.cpu;
	return (
		<Facts
			title="CPU and system memory"
			rows={[
				["Processors", count(c.availableProcessors)],
				["This process, since start", percent(c.averageLoad, 1)],
				["This process, JVM reading", percent(c.processCpuLoad, 1)],
				["Whole system", percent(c.systemCpuLoad, 1)],
				["Load average", c.systemLoadAverage >= 0 ? c.systemLoadAverage.toFixed(2) : "—"],
				["Memory free", c.totalPhysicalMemory ? `${bytes(c.freePhysicalMemory)} of ${bytes(c.totalPhysicalMemory)}` : "—"],
				["Swap free", c.totalSwap ? `${bytes(c.freeSwap)} of ${bytes(c.totalSwap)}` : "none"],
			]}
		/>
	);
}

function Collection({ s }: { s: Snapshot }) {
	return (
		<Facts
			title="Garbage collection"
			action={
				<Tooltip title={`${percent(s.gcHealth.ratio, 2)} of uptime spent in garbage collection`}>
					<Chip size="small" variant="outlined" color={gcColor[s.gcHealth.status] ?? "default"} label={s.gcHealth.label} />
				</Tooltip>
			}
			rows={[
				...s.gc.map((c): [string, ReactNode] => [c.name, `${count(c.collectionCount)} · ${ms(c.collectionTime)}`]),
				...s.fullGcCauses.map((c): [string, ReactNode] => [`Full GC: ${c.cause}`, `${count(c.collections)} · ${ms(c.timeMs)}`]),
			]}
		>
			{!s.fullGcCauses.length && (
				<Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
					No full collections since start.
				</Typography>
			)}
		</Facts>
	);
}

function Threads({ s }: { s: Snapshot }) {
	const t = s.threads;
	return (
		<Facts
			title="Threads"
			rows={[
				["Daemon", count(t.daemonCount)],
				["Started since start", count(t.totalStartedCount)],
				["Deadlocked", t.deadlocked.length ? <Box component="span" sx={{ color: "error.main" }}>{t.deadlocked.join(", ")}</Box> : "none"],
				...t.busiest.map((b): [string, ReactNode] => [
					b.name,
					`${b.recentLoad != null ? percent(b.recentLoad, 1) : `${b.cpuSeconds.toFixed(1)} s`} · ${b.state.toLowerCase()}`,
				]),
			]}
		>
			<Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
				The busiest threads by CPU since the previous reading.
			</Typography>
		</Facts>
	);
}

function Http({ s }: { s: Snapshot }) {
	const c = s.connector;
	if (!c) return <Facts title="HTTP" rows={[["Status", "Not listening, or boxlang-express too old to say"]]} />;
	return (
		<Facts
			title="HTTP"
			rows={[
				["Requests now", `${count(c.activeRequests)}, ${count(c.maxActiveRequests)} at most`],
				["Connections now", `${count(c.activeConnections)}, ${count(c.maxActiveConnections)} at most`],
				["Average time", s.requestTiming?.requests ? ms(s.requestTiming.averageMs) : "—"],
				["Slowest", s.requestTiming?.requests ? ms(s.requestTiming.slowestMs) : "—"],
				["Sent", bytes(c.bytesSent)],
				["Received", bytes(c.bytesReceived)],
			]}
		/>
	);
}

function Runtime({ s }: { s: Snapshot }) {
	return (
		<Facts
			title="Runtime"
			rows={[
				["BoxLang", s.boxlangVersion || "—"],
				["Java", `${s.process.javaVersion} · ${s.jvm.vmName}`],
				["Vendor", s.jvm.vmVendor],
				["Classes loaded", count(s.jvm.loadedClassCount)],
				["OS", `${s.process.osName} ${s.process.osVersion} (${s.process.osArch})`],
				["PID", s.process.pid ?? "—"],
				["Directory", s.process.userDir],
			]}
		>
			<Box component="details" sx={{ mt: 1.5 }}>
				<Typography component="summary" variant="body2" sx={{ cursor: "pointer" }}>
					JVM options
				</Typography>
				<Box
					component="pre"
					sx={{ mt: 1, p: 1.5, borderRadius: 1, bgcolor: "background.raised", fontSize: "0.75rem", whiteSpace: "pre-wrap", overflowWrap: "anywhere", m: 0 }}
				>
					{s.jvm.jvmArguments.join("\n") || "none"}
				</Box>
			</Box>
		</Facts>
	);
}

function Mysql({ s }: { s: Snapshot }) {
	const db = s.mysql;
	if (!db) return <Facts title="MySQL" rows={[["Status", "MySQL didn't say (no privilege, or not MySQL)"]]} />;
	return (
		<Facts
			title="MySQL"
			rows={[
				["Version", db.version],
				["Up", duration(db.uptimeSeconds)],
				["Buffer pool", `${bytes(db.bufferPoolDataBytes)} of ${bytes(db.bufferPoolBytes)} holds data`],
				["Reads from memory", `${percent(db.hitRate, 2)}${db.recentHitRate != null ? ` · ${percent(db.recentHitRate, 2)} lately` : ""}`],
				["Connections", `${count(db.threadsConnected)} of ${count(db.maxConnections)} (${db.threadsRunning} running)`],
				["Queries", count(db.queries)],
				["Slow queries", `${count(db.slowQueries)} (over ${db.longQuerySeconds} s)`],
				["Temporary tables on disk", `${count(db.tmpDiskTables)} of ${count(db.tmpTables)}`],
			]}
		/>
	);
}

function LargestTables({ tables }: { tables: NonNullable<Snapshot["mysql"]>["tables"] }) {
	return (
		<Card title="Largest MySQL tables">
			<Table size="small">
				<TableHead>
					<TableRow>
						<TableCell>Table</TableCell>
						<TableCell align="right">Rows</TableCell>
						<TableCell align="right">Data</TableCell>
						<TableCell align="right">Indexes</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{tables.map((t) => (
						<TableRow key={t.name}>
							<TableCell>{t.name}</TableCell>
							<TableCell align="right">{count(t.rows)}</TableCell>
							<TableCell align="right">{bytes(t.dataBytes)}</TableCell>
							<TableCell align="right">{bytes(t.indexBytes)}</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
			<Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
				Row counts and sizes are MySQL's estimates.
			</Typography>
		</Card>
	);
}

export function SystemPage() {
	return (
		<AdminOnly>
			<Server />
		</AdminOnly>
	);
}
