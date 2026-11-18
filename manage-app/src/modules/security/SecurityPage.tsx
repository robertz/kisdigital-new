import type { ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
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
import { BarChart } from "@mui/x-charts/BarChart";
import { api, errorMessage } from "../../app/api";
import { AdminOnly } from "../../shared/AdminOnly";
import { Card, CardBody, Empty } from "../../shared/cards";
import { Page, PageHeader } from "../../shared/Page";
import { formatDateTime } from "../../shared/dates";
import { CATEGORY_COLORS, CATEGORY_HELP } from "./categories";
import { SECURITY_RANGES, type SecurityRange } from "./routes";

interface Category {
	id: string;
	label: string;
}

interface Report {
	range: SecurityRange;
	hourly: boolean;
	backfilling: boolean;
	categories: Category[];
	totals: { requests: number; malicious: number; ips: number; answered2xx: number };
	byCategory: Record<string, number>;
	series: ({ t: string } & Record<string, number | string>)[];
	topIps: { ip: string; count: number; categories: string[]; lastSeen: string }[];
	topPaths: { path: string; category: string; count: number; ips: number }[];
	answered: { method: string; path: string; category: string; status: number; count: number }[];
	recent: { time: string; method: string; path: string; query: string; status: number | ""; ip: string; userAgent: string; category: string }[];
}

const route = getRouteApi("/security");
const RANGE_LABELS: Record<SecurityRange, string> = { "24h": "24 hours", "7d": "7 days", "30d": "30 days" };
const compact = new Intl.NumberFormat(undefined, { notation: "compact" });

function KindChip({ id, labels }: { id: string; labels: Record<string, string> }) {
	return (
		<Tooltip title={CATEGORY_HELP[id] ?? ""}>
			<Chip
				size="small"
				variant="outlined"
				label={labels[id] ?? id}
				sx={{ borderColor: CATEGORY_COLORS[id], color: CATEGORY_COLORS[id], fontWeight: 600 }}
			/>
		</Tooltip>
	);
}

function Tile({ label, value, detail, tone }: { label: string; value: ReactNode; detail?: ReactNode; tone?: "warning" | "error" }) {
	return (
		<Paper sx={{ p: 2.5, minWidth: 0 }}>
			<Typography variant="overline" color="text.secondary">
				{label}
			</Typography>
			<Typography variant="h1" component="p" color={tone ? `${tone}.main` : "text.primary"} sx={{ fontVariantNumeric: "tabular-nums" }} noWrap>
				{value}
			</Typography>
			{detail && (
				<Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
					{detail}
				</Typography>
			)}
		</Paper>
	);
}

function bucketLabel(iso: string, hourly: boolean) {
	const date = new Date(iso);
	return hourly
		? date.toLocaleTimeString(undefined, { hour: "numeric" })
		: date.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

function Security() {
	const range = route.useSearch().range ?? "7d";
	const navigate = useNavigate();
	const report = useQuery({
		queryKey: ["security", range],
		queryFn: () => api.get<Report>(`/manage/api/security?range=${range}`),
		placeholderData: keepPreviousData,
		refetchInterval: 60_000,
	});
	const data = report.data;
	const labels: Record<string, string> = Object.fromEntries((data?.categories ?? []).map((c) => [c.id, c.label]));
	const kinds = (data?.categories ?? []).filter((c) => (data?.byCategory[c.id] ?? 0) > 0);
	const share = data && data.totals.requests > 0 ? (data.totals.malicious / data.totals.requests) * 100 : 0;
	const topKind = kinds.slice().sort((a, b) => (data!.byCategory[b.id] ?? 0) - (data!.byCategory[a.id] ?? 0))[0];

	return (
		<Page>
			<PageHeader
				eyebrow="Admin"
				title="Security"
				subtitle="Requests that look like attacks, or probes for things this site doesn't have. This only watches: nothing is blocked."
				actions={
					<ToggleButtonGroup
						exclusive
						size="small"
						value={range}
						onChange={(_event, value: SecurityRange | null) => value && navigate({ to: "/security", search: value === "7d" ? {} : { range: value } })}
						aria-label="Time range"
					>
						{SECURITY_RANGES.map((r) => (
							<ToggleButton key={r} value={r} sx={{ whiteSpace: "nowrap", px: 1.5 }}>
								{RANGE_LABELS[r]}
							</ToggleButton>
						))}
					</ToggleButtonGroup>
				}
			/>

			{report.isError && (
				<Alert severity="error" sx={{ mb: 2 }}>
					{errorMessage(report.error, "Couldn't load the security report.")}
				</Alert>
			)}
			{data?.backfilling && (
				<Alert severity="info" sx={{ mb: 2 }}>
					Still labelling requests logged before this page existed. Earlier days will fill in over the next few minutes.
				</Alert>
			)}

			<Box sx={{ height: 4, mb: 1 }}>{report.isFetching && !report.isPending && <LinearProgress />}</Box>

			<Box sx={{ display: "grid", gap: 2, mb: 2, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" } }}>
				<Tile
					label="Malicious requests"
					value={data ? data.totals.malicious.toLocaleString() : "…"}
					detail={data ? `${share < 10 ? share.toFixed(1) : Math.round(share)}% of ${data.totals.requests.toLocaleString()} requests` : undefined}
					tone={data && data.totals.malicious > 0 ? "warning" : undefined}
				/>
				<Tile label="Source IPs" value={data ? data.totals.ips.toLocaleString() : "…"} detail="distinct addresses behind them" />
				<Tile
					label="Most common"
					value={topKind ? labels[topKind.id] : data ? "None" : "…"}
					detail={topKind ? `${data!.byCategory[topKind.id].toLocaleString()} requests` : undefined}
				/>
				<Tile
					label="Answered 2xx"
					value={data ? data.totals.answered2xx.toLocaleString() : "…"}
					detail="flagged requests that got a success status"
					tone={data && data.totals.answered2xx > 0 ? "error" : undefined}
				/>
			</Box>

			<Stack spacing={2}>
				<Card title={data?.hourly ? "Per hour" : "Per day"}>
					<CardBody query={report} height={320}>
						{(d) =>
							d.totals.malicious === 0 ? (
								<Empty>Nothing malicious in the last {RANGE_LABELS[d.range]}.</Empty>
							) : (
								<BarChart
									height={300}
									grid={{ horizontal: true }}
									xAxis={[
										{
											scaleType: "band",
											data: d.series.map((point) => bucketLabel(point.t, d.hourly)),
											tickInterval: (_value: string, index: number) => index % (d.hourly ? 3 : d.series.length > 10 ? 3 : 1) === 0,
										},
									]}
									yAxis={[{ width: 44, valueFormatter: (value: number) => compact.format(value) }]}
									series={kinds.map((kind) => ({
										data: d.series.map((point) => Number(point[kind.id] ?? 0)),
										label: kind.label,
										stack: "kinds",
										color: CATEGORY_COLORS[kind.id],
									}))}
									slotProps={{ legend: { direction: "horizontal", position: { vertical: "bottom", horizontal: "center" } } }}
								/>
							)
						}
					</CardBody>
				</Card>

				<Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, alignItems: "start" }}>
					<Card title="By kind">
						<CardBody query={report} height={260}>
							{(d) =>
								kinds.length === 0 ? (
									<Empty>Nothing to break down.</Empty>
								) : (
									<Stack spacing={1.5}>
										{kinds
											.slice()
											.sort((a, b) => d.byCategory[b.id] - d.byCategory[a.id])
											.map((kind) => {
												const count = d.byCategory[kind.id];
												const max = Math.max(...kinds.map((k) => d.byCategory[k.id]));
												return (
													<Tooltip key={kind.id} title={CATEGORY_HELP[kind.id] ?? ""} placement="top-start">
														<Box>
															<Stack direction="row" spacing={2} sx={{ justifyContent: "space-between", mb: 0.5 }}>
																<Typography variant="body2">{kind.label}</Typography>
																<Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
																	{count.toLocaleString()}
																</Typography>
															</Stack>
															<LinearProgress
																variant="determinate"
																value={(count / max) * 100}
																sx={{ height: 6, borderRadius: 3, "& .MuiLinearProgress-bar": { bgcolor: CATEGORY_COLORS[kind.id] } }}
															/>
														</Box>
													</Tooltip>
												);
											})}
									</Stack>
								)
							}
						</CardBody>
					</Card>

					<Card title="Top sources">
						<CardBody query={report} height={260}>
							{(d) =>
								d.topIps.length === 0 ? (
									<Empty>No sources to show.</Empty>
								) : (
									<Box sx={{ overflowX: "auto" }}>
									<Table size="small">
										<TableHead>
											<TableRow>
												<TableCell>IP</TableCell>
												<TableCell align="right">Requests</TableCell>
												<TableCell>Kinds</TableCell>
												<TableCell>Last seen</TableCell>
											</TableRow>
										</TableHead>
										<TableBody>
											{d.topIps.map((row) => (
												<TableRow key={row.ip} hover>
													<TableCell sx={{ fontFamily: "monospace", whiteSpace: "nowrap" }}>{row.ip || "unknown"}</TableCell>
													<TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>
														{row.count.toLocaleString()}
													</TableCell>
													<TableCell>
														<Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
															{row.categories
																.slice()
																.sort((a, b) => (d.byCategory[b] ?? 0) - (d.byCategory[a] ?? 0))
																.slice(0, 3)
																.map((id) => (
																	<KindChip key={id} id={id} labels={labels} />
																))}
															{row.categories.length > 3 && (
																<Tooltip title={row.categories.slice().sort((a, b) => (d.byCategory[b] ?? 0) - (d.byCategory[a] ?? 0)).slice(3).map((id) => labels[id] ?? id).join(", ")}>
																	<Chip size="small" label={`+${row.categories.length - 3}`} />
																</Tooltip>
															)}
														</Stack>
													</TableCell>
													<TableCell sx={{ whiteSpace: "nowrap" }}>{formatDateTime(row.lastSeen)}</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
									</Box>
								)
							}
						</CardBody>
					</Card>

					<Card title="Most-probed paths">
						<CardBody query={report} height={260}>
							{(d) =>
								d.topPaths.length === 0 ? (
									<Empty>No paths to show.</Empty>
								) : (
									<Stack spacing={1}>
										{d.topPaths.map((row) => (
											<Stack key={row.path} direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
												<Box sx={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, bgcolor: CATEGORY_COLORS[row.category] }} />
												<Typography variant="body2" noWrap title={row.path} sx={{ flex: 1, fontFamily: "monospace" }}>
													{row.path}
												</Typography>
												<Typography variant="caption" color="text.secondary" noWrap>
													{row.ips.toLocaleString()} {row.ips === 1 ? "IP" : "IPs"}
												</Typography>
												<Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums", minWidth: 40, textAlign: "right" }}>
													{row.count.toLocaleString()}
												</Typography>
											</Stack>
										))}
									</Stack>
								)
							}
						</CardBody>
					</Card>

					<Card title="Answered with a 2xx">
						<CardBody query={report} height={260}>
							{(d) => (
								<>
									<Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
										Flagged requests that got a success status. Usually harmless (an injection attempt on the home page still gets the
										home page), but this is the list worth reading.
									</Typography>
									{d.answered.length === 0 ? (
										<Empty>None. Every flagged request was turned away.</Empty>
									) : (
										<Stack spacing={1}>
											{d.answered.map((row) => (
												<Stack key={`${row.method} ${row.path} ${row.category}`} direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
													<KindChip id={row.category} labels={labels} />
													<Typography variant="body2" noWrap title={row.path} sx={{ flex: 1, fontFamily: "monospace" }}>
														{row.method} {row.path}
													</Typography>
													<Typography variant="caption" color="text.secondary">
														{row.status}
													</Typography>
													<Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums", minWidth: 32, textAlign: "right" }}>
														{row.count.toLocaleString()}
													</Typography>
												</Stack>
											))}
										</Stack>
									)}
								</>
							)}
						</CardBody>
					</Card>
				</Box>

				<Card title="Latest">
					<CardBody query={report} height={320}>
						{(d) =>
							d.recent.length === 0 ? (
								<Empty>Nothing flagged in this range.</Empty>
							) : (
								<Box sx={{ overflowX: "auto" }}>
									<Table size="small">
										<TableHead>
											<TableRow>
												<TableCell>Time</TableCell>
												<TableCell>Kind</TableCell>
												<TableCell>Request</TableCell>
												<TableCell>Status</TableCell>
												<TableCell>IP</TableCell>
											</TableRow>
										</TableHead>
										<TableBody>
											{d.recent.map((row, i) => (
												<TableRow key={`${row.time}-${i}`} hover>
													<TableCell sx={{ whiteSpace: "nowrap" }}>{formatDateTime(row.time, true)}</TableCell>
													<TableCell>
														<KindChip id={row.category} labels={labels} />
													</TableCell>
													<TableCell sx={{ maxWidth: 520 }}>
														<Tooltip title={row.userAgent || "No user agent"} placement="top-start">
															<Typography variant="body2" sx={{ fontFamily: "monospace", overflowWrap: "anywhere" }}>
																{row.method} {row.path}
																{row.query ? `?${row.query}` : ""}
															</Typography>
														</Tooltip>
													</TableCell>
													<TableCell>{row.status}</TableCell>
													<TableCell sx={{ fontFamily: "monospace", whiteSpace: "nowrap" }}>{row.ip}</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</Box>
							)
						}
					</CardBody>
				</Card>
			</Stack>
		</Page>
	);
}

export function SecurityPage() {
	return (
		<AdminOnly>
			<Security />
		</AdminOnly>
	);
}
