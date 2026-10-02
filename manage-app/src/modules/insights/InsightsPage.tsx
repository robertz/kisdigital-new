import { useQuery } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import { LineChart } from "@mui/x-charts/LineChart";
import { api } from "../../app/api";
import { AdminOnly } from "../../shared/AdminOnly";
import { Page, PageHeader } from "../../shared/Page";
import { BarList, Card, CardBody, Empty, type CountRow } from "../../shared/cards";

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

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function shortDate(isoDate: string): string {
	const [year, month, day] = isoDate.split("-").map(Number);
	return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<Box>
			<Typography sx={{ fontSize: "1.5rem", fontWeight: 700, lineHeight: 1.2 }}>{value}</Typography>
			<Typography variant="caption" color="text.secondary">
				{label}
			</Typography>
		</Box>
	);
}

function Insights() {
	const theme = useTheme();
	const traffic = useQuery({
		queryKey: ["dashboard", "traffic"],
		queryFn: () => api.get<Traffic>("/manage/api/dashboard/traffic"),
	});
	const topPosts = useQuery({
		queryKey: ["insights", "top-posts"],
		queryFn: () => api.get<TopPosts>("/manage/api/dashboard/top-posts?limit=10"),
	});
	const audience = useQuery({
		queryKey: ["insights", "audience"],
		queryFn: () => api.get<Audience>("/manage/api/dashboard/audience?limit=10"),
	});

	return (
		<Page>
			<PageHeader eyebrow="Readers" title="Insights" subtitle="Traffic from this site's own access log, last 30 days." />

			<Stack spacing={2}>
				<Card title="Page views">
					<CardBody query={traffic} height={340}>
						{(data) =>
							data.days.length === 0 ? (
								<Empty>No visits recorded yet.</Empty>
							) : (
								<>
									<Stack direction="row" spacing={5} sx={{ mb: 1 }}>
										<Stat label="total views" value={data.total.toLocaleString()} />
										<Stat label="peak day" value={Math.max(...data.days.map((day) => day.views)).toLocaleString()} />
										<Stat label="today" value={data.today.toLocaleString()} />
									</Stack>
									<LineChart
										height={300}
										hideLegend
										grid={{ horizontal: true }}
										xAxis={[
											{
												scaleType: "point",
												data: data.days.map((day) => day.date),
												valueFormatter: (value: string) => shortDate(value),
												tickInterval: (_value: string, index: number) => index % 4 === 0,
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
								</>
							)
						}
					</CardBody>
				</Card>

				<Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" } }}>
					<Card title="Top posts">
						<CardBody query={topPosts} height={260}>
							{(data) =>
								data.posts.length === 0 ? (
									<Empty>No visits recorded yet.</Empty>
								) : (
									<Stack spacing={1.25}>
										{data.posts.map((post) => (
											<Stack key={post.url} direction="row" spacing={2} sx={{ justifyContent: "space-between" }}>
												<Link href={post.url} target="_blank" rel="noopener" underline="hover" color="text.primary" variant="body2" noWrap sx={{ fontWeight: 600 }}>
													{post.title}
												</Link>
												<Typography variant="body2" color="text.secondary" noWrap sx={{ fontVariantNumeric: "tabular-nums" }}>
													{compact.format(post.views)} views
												</Typography>
											</Stack>
										))}
									</Stack>
								)
							}
						</CardBody>
					</Card>
					<Card title="Top referrers">
						<CardBody query={audience} height={260}>
							{(data) => <BarList rows={data.referrers} empty="No referrer data yet." />}
						</CardBody>
					</Card>
					<Card title="Top searches">
						<CardBody query={audience} height={220}>
							{(data) => <BarList rows={data.searches} empty="No searches recorded yet." quoted />}
						</CardBody>
					</Card>
					<Card title="Searches with no results">
						<CardBody query={audience} height={220}>
							{(data) => <BarList rows={data.zeroSearches} empty="No searches have come up empty recently." quoted />}
						</CardBody>
					</Card>
					<Card title="Top 404s" sx={{ gridColumn: { lg: "1 / -1" } }}>
						<CardBody query={audience} height={220}>
							{(data) => <BarList rows={data.notFound} empty="No 404s recorded. Nothing broken lately." />}
						</CardBody>
					</Card>
				</Box>
			</Stack>
		</Page>
	);
}

export function InsightsPage() {
	return (
		<AdminOnly>
			<Insights />
		</AdminOnly>
	);
}
