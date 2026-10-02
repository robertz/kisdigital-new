import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
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
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { api, errorMessage } from "../../app/api";
import { AdminOnly } from "../../shared/AdminOnly";
import { Page, PageHeader } from "../../shared/Page";
import { formatDateTime } from "../../shared/dates";
import { SystemTabs } from "./SystemTabs";

type Values = Record<string, string | number>;

interface ServerSnapshot {
	memory: Values & { heapPercent: number };
	cpu: Values;
	disk: Values & { usedPercent: number };
	jvm: Values & { startTimeUtc: string };
	gc: { name: string; collectionCount: string; collectionTime: string }[];
	gcHealth: { ratioPercent: string; status: string; label: string };
	threads: Values;
	process: Values;
	connector?: Values | null;
}

const REFRESH_MS = 5000;

function Section({ title, hint, action, children }: { title: string; hint?: string; action?: ReactNode; children: ReactNode }) {
	return (
		<Box component="section" sx={{ mb: 3 }}>
			<Stack direction="row" spacing={2} sx={{ alignItems: "flex-end", justifyContent: "space-between", mb: 1.5 }}>
				<Box>
					<Typography variant="h2">{title}</Typography>
					{hint && (
						<Typography variant="body2" color="text.secondary">
							{hint}
						</Typography>
					)}
				</Box>
				{action}
			</Stack>
			<Paper sx={{ p: 2.5 }}>{children}</Paper>
		</Box>
	);
}

function StatGrid({ items }: { items: [label: string, value: ReactNode][] }) {
	return (
		<Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))" }}>
			{items.map(([label, value]) => (
				<Box key={label} sx={{ minWidth: 0 }}>
					<Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
						{label}
					</Typography>
					<Typography sx={{ fontWeight: 600, overflowWrap: "anywhere", fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
				</Box>
			))}
		</Box>
	);
}

function UsageBar({ label, detail, percent }: { label: string; detail: string; percent: number }) {
	const color = percent >= 90 ? "error" : percent >= 75 ? "warning" : "primary";
	return (
		<Box sx={{ mb: 2.5 }}>
			<Stack direction="row" spacing={2} sx={{ justifyContent: "space-between", mb: 0.75 }}>
				<Typography variant="body2" color="text.secondary">
					{label}
				</Typography>
				<Typography variant="body2" sx={{ fontWeight: 600 }}>
					{detail}
				</Typography>
			</Stack>
			<LinearProgress variant="determinate" color={color} value={Math.min(100, percent)} sx={{ height: 8, borderRadius: 4 }} />
		</Box>
	);
}

const gcColor: Record<string, "success" | "info" | "warning" | "error"> = {
	healthy: "success",
	watch: "info",
	investigate: "warning",
	problem: "error",
};

function Server() {
	const snapshot = useQuery({
		queryKey: ["system"],
		queryFn: () => api.get<{ server: ServerSnapshot }>("/manage/api/system").then((r) => r.server),
		refetchInterval: REFRESH_MS,
		staleTime: 0,
	});
	const s = snapshot.data;

	return (
		<Page>
			<PageHeader
				eyebrow="System"
				title="Server"
				subtitle={'A live snapshot of this process: memory, CPU, disk and JVM internals. "Disk" is this container\'s own filesystem, not the host\'s.'}
				actions={
					s && (
						<Chip
							size="small"
							color={snapshot.isError ? "error" : "success"}
							variant="outlined"
							label={snapshot.isError ? "Updates paused" : `Live, every ${REFRESH_MS / 1000}s`}
						/>
					)
				}
			/>
			<SystemTabs value="server" />

			{snapshot.isPending && <Skeleton variant="rounded" height={480} />}
			{snapshot.isError && (
				<Alert severity="error" sx={{ mb: 2 }}>
					{errorMessage(snapshot.error, "Couldn't load server metrics.")}
				</Alert>
			)}

			{s && (
				<>
					<Section title="Memory" hint="JVM heap and non-heap memory usage.">
						<UsageBar label="Heap used" detail={`${s.memory.heapUsed} / ${s.memory.heapMax} (${s.memory.heapPercent}%)`} percent={s.memory.heapPercent} />
						<StatGrid
							items={[
								["Heap committed", s.memory.heapCommitted],
								["Non-heap used", s.memory.nonHeapUsed],
								["Non-heap committed", s.memory.nonHeapCommitted],
								["Runtime total", s.memory.runtimeTotal],
								["Runtime free", s.memory.runtimeFree],
								["Runtime max", s.memory.runtimeMax],
							]}
						/>
					</Section>

					<Section title="CPU and load" hint="Process and system CPU usage, plus physical memory and swap where the platform exposes them.">
						<StatGrid
							items={[
								["Available processors", s.cpu.availableProcessors],
								["System load average", s.cpu.systemLoadAverage],
								["Process CPU load", s.cpu.processCpuLoad],
								["System CPU load", s.cpu.systemCpuLoad],
								["Total physical memory", s.cpu.totalPhysicalMemory],
								["Free physical memory", s.cpu.freePhysicalMemory],
								["Total swap", s.cpu.totalSwap],
								["Free swap", s.cpu.freeSwap],
							]}
						/>
					</Section>

					<Section title="Disk" hint="Container filesystem (/), not the underlying host's disk.">
						<UsageBar label="Used" detail={`${s.disk.usedPercent}% of ${s.disk.totalSpace}`} percent={s.disk.usedPercent} />
						<StatGrid
							items={[
								["Free space", s.disk.freeSpace],
								["Usable space", s.disk.usableSpace],
							]}
						/>
					</Section>

					<Section title="JVM" hint="Runtime identity, uptime and class loading.">
						<StatGrid
							items={[
								["VM name", s.jvm.vmName],
								["VM vendor", s.jvm.vmVendor],
								["VM version", s.jvm.vmVersion],
								["Spec version", s.jvm.specVersion],
								["Started", formatDateTime(s.jvm.startTimeUtc, true) || s.jvm.startTime],
								["Uptime", s.jvm.uptime],
								["Loaded classes", s.jvm.loadedClassCount],
								["Total loaded (cumulative)", s.jvm.totalLoadedClassCount],
								["Unloaded classes", s.jvm.unloadedClassCount],
							]}
						/>
					</Section>

					<Section
						title="Garbage collection"
						hint="One row per collector this JVM is running. Status reflects total GC pause time as a share of uptime."
						action={
							<Tooltip title={`${s.gcHealth.ratioPercent} of uptime spent in GC`}>
								<Chip size="small" variant="outlined" color={gcColor[s.gcHealth.status] ?? "default"} label={s.gcHealth.label} />
							</Tooltip>
						}
					>
						{s.gc.length === 0 ? (
							<Typography variant="body2" color="text.secondary">
								No collectors reported.
							</Typography>
						) : (
							<Table size="small">
								<TableHead>
									<TableRow>
										<TableCell>Collector</TableCell>
										<TableCell align="right">Collections</TableCell>
										<TableCell align="right">Total time</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{s.gc.map((row) => (
										<TableRow key={row.name}>
											<TableCell>{row.name}</TableCell>
											<TableCell align="right">{row.collectionCount}</TableCell>
											<TableCell align="right" sx={{ color: "text.secondary" }}>
												{row.collectionTime}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</Section>

					<Section title="Threads">
						<StatGrid
							items={[
								["Live", s.threads.liveCount],
								["Peak", s.threads.peakCount],
								["Daemon", s.threads.daemonCount],
								["Total started", s.threads.totalStartedCount],
							]}
						/>
					</Section>

					<Section title="HTTP connector" hint="Live request and connection counts straight from Undertow's own listener, not derived from the request log.">
						{s.connector ? (
							<StatGrid
								items={[
									["Total requests", s.connector.requestCount],
									["Active requests", s.connector.activeRequests],
									["Peak active requests", s.connector.maxActiveRequests],
									["Active connections", s.connector.activeConnections],
									["Peak active connections", s.connector.maxActiveConnections],
									["Errors", s.connector.errorCount],
									["Avg processing time", s.connector.avgProcessingTime],
									["Max processing time", s.connector.maxProcessingTime],
									["Bytes sent", s.connector.bytesSent],
									["Bytes received", s.connector.bytesReceived],
								]}
							/>
						) : (
							<Typography variant="body2" color="text.secondary">
								Not available. Requires a boxlang-express version with getConnectorStatistics().
							</Typography>
						)}
					</Section>

					<Section title="Process">
						<StatGrid
							items={[
								["PID", s.process.pid],
								["OS", `${s.process.osName} ${s.process.osVersion}`],
								["Architecture", s.process.osArch],
								["Java version", s.process.javaVersion],
								["Working directory", s.process.userDir],
							]}
						/>
					</Section>
				</>
			)}
		</Page>
	);
}

export function SystemPage() {
	return (
		<AdminOnly>
			<Server />
		</AdminOnly>
	);
}
