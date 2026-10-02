import type { ReactNode } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import Add from "@mui/icons-material/Add";
import ArticleOutlined from "@mui/icons-material/ArticleOutlined";
import ChatOutlined from "@mui/icons-material/ChatOutlined";
import EditNoteOutlined from "@mui/icons-material/EditNoteOutlined";
import Schedule from "@mui/icons-material/Schedule";
import TrendingDown from "@mui/icons-material/TrendingDown";
import TrendingUp from "@mui/icons-material/TrendingUp";
import { BarChart } from "@mui/x-charts/BarChart";
import { Gauge, gaugeClasses } from "@mui/x-charts/Gauge";
import { LineChart } from "@mui/x-charts/LineChart";
import { PieChart } from "@mui/x-charts/PieChart";
import { SparkLineChart } from "@mui/x-charts/SparkLineChart";
import { api, errorMessage } from "../../app/api";
import { boot, isAdmin } from "../../app/boot";
import { Page, PageHeader } from "../../shared/Page";
import { StatusBadge } from "../../shared/StatusBadge";
import { formatLocalDateTime, formatMonthDay } from "../../shared/dates";
import { ButtonLink, TextLink } from "../../shared/links";
import { BarList, Card, CardBody, Empty, type CountRow } from "../../shared/cards";

interface Dashboard {
	contentHealth: { draftCount: number; upcomingCount: number; missingCoverCount: number; missingTagsCount: number };
	recentActivity: { id: string; title: string; status: string; lastUpdated: string }[];
	pendingComments: number;
	statusCounts: { draft: number; scheduled: number; published: number; archived: number };
	upcoming: { id: string; title: string; publishDate: string }[];
}

interface Traffic {
	days: { date: string; views: number }[];
	total: number;
	previousTotal: number;
	today: number;
}

interface TopPosts {
	posts: { title: string; url: string; views: number }[];
}

interface Audience {
	referrers: CountRow[] | null;
	searches: CountRow[] | null;
	zeroSearches: CountRow[] | null;
	notFound: CountRow[] | null;
}

interface SystemStats {
	heapUsed: number;
	heapMax: number;
	diskUsed: number;
	diskTotal: number;
	cpuLoad?: number | null;
	uptimeMs: number;
}

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function formatBytes(bytes: number): string {
	if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
	return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

function formatUptime(ms: number): string {
	const hours = Math.floor(ms / 3_600_000);
	if (hours >= 48) return `${Math.floor(hours / 24)} days`;
	if (hours >= 1) return `${hours} h`;
	return `${Math.max(1, Math.floor(ms / 60_000))} min`;
}

function shortDate(isoDate: string): string {
	const [year, month, day] = isoDate.split("-").map(Number);
	return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function truncate(text: string, length: number): string {
	return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<Box component="section" sx={{ mb: 4 }}>
			<Typography variant="overline" color="text.secondary" component="h2" sx={{ display: "block", mb: 1.5 }}>
				{title}
			</Typography>
			{children}
		</Box>
	);
}

interface StatProps {
	label: string;
	value: ReactNode;
	hint?: ReactNode;
	icon?: ReactNode;
	spark?: number[];
	loading?: boolean;
}

function StatCard({ label, value, hint, icon, spark, loading = false }: StatProps) {
	const theme = useTheme();
	return (
		<Paper sx={{ p: 2.5, minWidth: 0 }}>
			<Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
				<Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
					{label}
				</Typography>
				{icon && <Box sx={{ color: "text.disabled", display: "flex" }}>{icon}</Box>}
			</Stack>
			<Typography sx={{ fontSize: "1.875rem", fontWeight: 700, lineHeight: 1.2, mt: 1 }}>
				{loading ? <Skeleton width={90} /> : value}
			</Typography>
			<Box sx={{ minHeight: 24, mt: 0.5, display: "flex", alignItems: "center" }}>
				{loading ? <Skeleton width={140} /> : hint}
			</Box>
			{spark && spark.length > 1 && (
				<Box sx={{ mt: 1, mx: -0.5 }}>
					<SparkLineChart
						data={spark}
						height={44}
						area
						curve="monotoneX"
						color={theme.palette.primary.main}
						sx={{ "& .MuiLineChart-area": { fillOpacity: 0.16 } }}
					/>
				</Box>
			)}
		</Paper>
	);
}

function Delta({ current, previous }: { current: number; previous: number }) {
	if (previous <= 0) return <Empty>Last 30 days</Empty>;
	const change = Math.round(((current - previous) / previous) * 100);
	const up = change >= 0;
	return (
		<Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
			<Chip
				size="small"
				color={up ? "success" : "error"}
				variant="outlined"
				icon={up ? <TrendingUp /> : <TrendingDown />}
				label={`${up ? "+" : ""}${change}%`}
			/>
			<Typography variant="caption" color="text.secondary">
				vs previous 30 days
			</Typography>
		</Stack>
	);
}

function UsageGauge({ label, percent, detail }: { label: string; percent: number | null; detail: string }) {
	const theme = useTheme();
	const color =
		percent === null
			? theme.palette.text.disabled
			: percent >= 90
				? theme.palette.error.main
				: percent >= 75
					? theme.palette.warning.main
					: theme.palette.primary.main;
	return (
		<Box sx={{ textAlign: "center", minWidth: 0 }}>
			<Gauge
				value={percent ?? 0}
				startAngle={-110}
				endAngle={110}
				height={130}
				text={() => (percent === null ? "n/a" : `${percent}%`)}
				sx={{
					[`& .${gaugeClasses.valueArc}`]: { fill: color },
					[`& .${gaugeClasses.valueText}`]: { fontSize: "1.25rem", fontWeight: 700 },
				}}
			/>
			<Typography variant="body2" sx={{ fontWeight: 600 }}>
				{label}
			</Typography>
			<Typography variant="caption" color="text.secondary">
				{detail}
			</Typography>
		</Box>
	);
}

export function HomePage() {
	const theme = useTheme();
	const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: () => api.get<Dashboard>("/manage/api/dashboard") });
	const topPosts = useQuery({
		queryKey: ["dashboard", "top-posts"],
		queryFn: () => api.get<TopPosts>("/manage/api/dashboard/top-posts"),
	});
	const traffic = useQuery({
		queryKey: ["dashboard", "traffic"],
		queryFn: () => api.get<Traffic>("/manage/api/dashboard/traffic"),
		enabled: isAdmin,
	});
	const audience = useQuery({
		queryKey: ["dashboard", "audience"],
		queryFn: () => api.get<Audience>("/manage/api/dashboard/audience"),
		enabled: isAdmin,
	});
	const system = useQuery({
		queryKey: ["dashboard", "system"],
		queryFn: () => api.get<SystemStats>("/manage/api/dashboard/system"),
		enabled: isAdmin,
		refetchInterval: 30_000,
	});

	const counts = dashboard.data?.statusCounts;
	const views = traffic.data?.days.map((day) => day.views) ?? [];

	const statusSlices = counts
		? [
				{ id: "published", label: "Published", value: counts.published, color: theme.palette.success.main },
				{ id: "draft", label: "Draft", value: counts.draft, color: theme.palette.warning.main },
				{ id: "scheduled", label: "Scheduled", value: counts.scheduled, color: theme.palette.info.main },
				{ id: "archived", label: "Archived", value: counts.archived, color: theme.palette.text.disabled },
			]
		: [];

	return (
		<Page>
			<PageHeader
				title="Dashboard"
				subtitle={`Welcome back, ${boot.user.displayName}.`}
				actions={
					<ButtonLink to="/posts/new" variant="contained" startIcon={<Add />}>
						New post
					</ButtonLink>
				}
			/>

			{dashboard.isError && (
				<Alert severity="error" sx={{ mb: 3 }}>
					{errorMessage(dashboard.error, "Couldn't load the dashboard.")}
				</Alert>
			)}

			<Section title="At a glance">
				<Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
					{isAdmin && (
						<StatCard
							label="Views today"
							loading={traffic.isPending}
							value={traffic.data ? traffic.data.today.toLocaleString() : "–"}
							hint={<Empty>Last 14 days</Empty>}
							spark={views.slice(-14)}
						/>
					)}
					{isAdmin && (
						<StatCard
							label="Views, 30 days"
							loading={traffic.isPending}
							value={traffic.data ? compact.format(traffic.data.total) : "–"}
							hint={traffic.data && <Delta current={traffic.data.total} previous={traffic.data.previousTotal} />}
							spark={views}
						/>
					)}
					<StatCard
						label="Published posts"
						icon={<ArticleOutlined />}
						loading={dashboard.isPending}
						value={counts ? counts.published.toLocaleString() : "–"}
						hint={counts && <Empty>{counts.archived} archived</Empty>}
					/>
					<StatCard
						label="Drafts"
						icon={<EditNoteOutlined />}
						loading={dashboard.isPending}
						value={counts ? counts.draft.toLocaleString() : "–"}
						hint={counts && <Empty>{counts.scheduled} scheduled</Empty>}
					/>
					{isAdmin && (
						<StatCard
							label="Pending comments"
							icon={<ChatOutlined />}
							loading={dashboard.isPending}
							value={dashboard.data ? dashboard.data.pendingComments.toLocaleString() : "–"}
							hint={
								<ButtonLink to="/comments" size="small" sx={{ ml: -0.75 }}>
									Review comments
								</ButtonLink>
							}
						/>
					)}
				</Box>
			</Section>

			<Section title={isAdmin ? "Traffic" : "Posts"}>
				<Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: isAdmin ? "2fr 1fr" : "1fr 2fr" } }}>
					{isAdmin && (
						<Card
							title="Page views, last 30 days"
							action={
								<ButtonLink to="/insights" size="small">
									Insights
								</ButtonLink>
							}
						>
							<CardBody query={traffic} height={280}>
								{(data) =>
									data.days.length === 0 ? (
										<Empty>No visits recorded yet.</Empty>
									) : (
										<LineChart
											height={280}
											hideLegend
											grid={{ horizontal: true }}
											xAxis={[
												{
													scaleType: "point",
													data: data.days.map((day) => day.date),
													valueFormatter: (value: string) => shortDate(value),
													tickInterval: (_value: string, index: number) => index % 5 === 0,
												},
											]}
											yAxis={[{ width: 44, valueFormatter: (value: number) => compact.format(value) }]}
											series={[
												{
													data: data.days.map((day) => day.views),
													label: "Page views",
													area: true,
													showMark: false,
													curve: "monotoneX",
													color: theme.palette.primary.main,
												},
											]}
											sx={{ "& .MuiLineChart-area": { fillOpacity: 0.16 } }}
										/>
									)
								}
							</CardBody>
						</Card>
					)}

					<Card title="Posts by status">
						<CardBody query={dashboard} height={280}>
							{() => (
								<>
									<PieChart
										height={190}
										hideLegend
										series={[
											{
												data: statusSlices.filter((slice) => slice.value > 0),
												innerRadius: 55,
												outerRadius: 85,
												paddingAngle: 2,
												cornerRadius: 4,
											},
										]}
									/>
									<Stack spacing={0.75} sx={{ mt: 1.5 }}>
										{statusSlices.map((slice) => (
											<Stack key={slice.id} direction="row" spacing={1} sx={{ alignItems: "center" }}>
												<Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: slice.color }} />
												<Typography variant="body2" sx={{ flex: 1 }}>
													{slice.label}
												</Typography>
												<Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
													{slice.value}
												</Typography>
											</Stack>
										))}
									</Stack>
								</>
							)}
						</CardBody>
					</Card>

					{!isAdmin && <TopPostsCard query={topPosts} />}
				</Box>
			</Section>

			<Section title="Content">
				<Box
					sx={{
						display: "grid",
						gap: 2,
						gridTemplateColumns: { xs: "1fr", md: "1fr 1fr", xl: isAdmin ? "1.5fr 1fr 1fr" : "1fr 1fr" },
					}}
				>
					{isAdmin && <TopPostsCard query={topPosts} sx={{ gridColumn: { md: "1 / -1", xl: "auto" } }} />}

					<Card title="Needs attention">
						<CardBody query={dashboard} height={220}>
							{(data) => (
								<Stack spacing={1.25}>
									<AttentionRow count={data.contentHealth.draftCount} label="drafts awaiting publish" />
									<AttentionRow count={data.contentHealth.missingCoverCount} label="published posts missing a cover image" />
									<AttentionRow count={data.contentHealth.missingTagsCount} label="published posts missing tags" />
									<Typography variant="overline" color="text.disabled" sx={{ pt: 1 }}>
										Scheduled next
									</Typography>
									{data.upcoming.length === 0 && <Empty>Nothing scheduled.</Empty>}
									{data.upcoming.map((post) => (
										<Stack key={post.id} direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
											<Schedule fontSize="small" color="info" />
											<TextLink
												to="/posts/$postId/edit"
												params={{ postId: post.id }}
												underline="hover"
												color="text.primary"
												variant="body2"
												noWrap
												sx={{ flex: 1, fontWeight: 600 }}
											>
												{post.title}
											</TextLink>
											<Typography variant="caption" color="text.secondary" noWrap>
												{formatLocalDateTime(post.publishDate)}
											</Typography>
										</Stack>
									))}
								</Stack>
							)}
						</CardBody>
					</Card>

					<Card
						title="Recent activity"
						action={
							<ButtonLink to="/posts" size="small">
								All posts
							</ButtonLink>
						}
					>
						<CardBody query={dashboard} height={220}>
							{(data) =>
								data.recentActivity.length === 0 ? (
									<Empty>No posts yet.</Empty>
								) : (
									<Stack spacing={1.25}>
										{data.recentActivity.map((row) => (
											<Stack key={row.id} direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
												<TextLink
													to="/posts/$postId/edit"
													params={{ postId: row.id }}
													underline="hover"
													color="text.primary"
													variant="body2"
													noWrap
													sx={{ flex: 1, fontWeight: 600 }}
												>
													{row.title}
												</TextLink>
												<StatusBadge status={row.status} />
												<Typography variant="caption" color="text.secondary" noWrap sx={{ width: 48, textAlign: "right" }}>
													{formatMonthDay(row.lastUpdated)}
												</Typography>
											</Stack>
										))}
									</Stack>
								)
							}
						</CardBody>
					</Card>
				</Box>
			</Section>

			{isAdmin && (
				<Section title="Audience, last 30 days">
					<Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
						<Card title="Top referrers">
							<CardBody query={audience} height={180}>
								{(data) => <BarList rows={data.referrers} empty="No referrer data yet." />}
							</CardBody>
						</Card>
						<Card title="Top searches">
							<CardBody query={audience} height={180}>
								{(data) => <BarList rows={data.searches} empty="No searches recorded yet." quoted />}
							</CardBody>
						</Card>
						<Card title="Searches with no results">
							<CardBody query={audience} height={180}>
								{(data) => <BarList rows={data.zeroSearches} empty="No searches have come up empty recently." quoted />}
							</CardBody>
						</Card>
						<Card title="Top 404s">
							<CardBody query={audience} height={180}>
								{(data) => <BarList rows={data.notFound} empty="No 404s recorded." />}
							</CardBody>
						</Card>
					</Box>
				</Section>
			)}

			{isAdmin && (
				<Section title="System">
					<Card
						title="Server health"
						action={
							<ButtonLink to="/server" size="small">
								System details
							</ButtonLink>
						}
					>
						<CardBody query={system} height={190}>
							{(data) => (
								<>
									<Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
										<UsageGauge
											label="JVM heap"
											percent={data.heapMax > 0 ? Math.round((data.heapUsed / data.heapMax) * 100) : null}
											detail={`${formatBytes(data.heapUsed)} of ${formatBytes(data.heapMax)}`}
										/>
										<UsageGauge
											label="Disk"
											percent={data.diskTotal > 0 ? Math.round((data.diskUsed / data.diskTotal) * 100) : null}
											detail={`${formatBytes(data.diskUsed)} of ${formatBytes(data.diskTotal)}`}
										/>
										<UsageGauge
											label="CPU"
											percent={typeof data.cpuLoad === "number" ? Math.round(data.cpuLoad * 100) : null}
											detail="System load"
										/>
									</Box>
									<Typography variant="caption" color="text.secondary" sx={{ mt: 2, textAlign: "center" }}>
										Up for {formatUptime(data.uptimeMs)}. Refreshes every 30 seconds.
									</Typography>
								</>
							)}
						</CardBody>
					</Card>
				</Section>
			)}
		</Page>
	);
}

function AttentionRow({ count, label }: { count: number; label: string }) {
	return (
		<Stack direction="row" spacing={1.5} sx={{ alignItems: "baseline" }}>
			<Typography
				sx={{ fontWeight: 700, minWidth: 28, fontVariantNumeric: "tabular-nums" }}
				color={count > 0 ? "warning.main" : "text.disabled"}
			>
				{count}
			</Typography>
			<Typography variant="body2" color={count > 0 ? "text.primary" : "text.secondary"}>
				{label}
			</Typography>
		</Stack>
	);
}

function TopPostsCard({ query, sx }: { query: UseQueryResult<TopPosts>; sx?: object }) {
	const theme = useTheme();
	return (
		<Card title="Top posts, last 30 days" sx={sx}>
			<CardBody query={query} height={260}>
				{(data) =>
					data.posts.length === 0 ? (
						<Empty>No visits recorded yet.</Empty>
					) : (
						<BarChart
							height={Math.max(180, data.posts.length * 34 + 40)}
							layout="horizontal"
							hideLegend
							borderRadius={4}
							yAxis={[
								{
									scaleType: "band",
									// The rank keeps band labels unique after truncation.
									data: data.posts.map((post, i) => `${i + 1}. ${truncate(post.title, 26)}`),
									width: 200,
								},
							]}
							xAxis={[{ tickNumber: 5, valueFormatter: (value: number) => compact.format(value) }]}
							series={[{ data: data.posts.map((post) => post.views), label: "Views", color: theme.palette.primary.main }]}
						/>
					)
				}
			</CardBody>
		</Card>
	);
}
