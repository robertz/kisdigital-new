import { useEffect, useState, type FormEvent } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Pagination from "@mui/material/Pagination";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import MailOutlined from "@mui/icons-material/MailOutlined";
import { api, errorMessage } from "../../app/api";
import { AdminOnly } from "../../shared/AdminOnly";
import { Page, PageHeader } from "../../shared/Page";
import { formatDate, formatDateTime } from "../../shared/dates";
import { SUBSCRIBER_STATUSES, type SubscriberSearch, type SubscriberStatus } from "./routes";

interface Subscriber {
	id: string;
	email: string;
	status: SubscriberStatus;
	created: string;
	confirmed: string;
	emailsSent: number;
	lastSent: string;
}

interface SubscriberPage {
	subscribers: Subscriber[];
	counts: Record<SubscriberStatus, number>;
	total: number;
	page: number;
	totalPages: number;
}

const route = getRouteApi("/subscribers");

const STATUS_LABELS: Record<SubscriberStatus, string> = {
	active: "Active",
	pending: "Pending",
	unsubscribed: "Unsubscribed",
	bounced: "Bounced",
	complained: "Complained",
};

const STATUS_COLORS: Record<SubscriberStatus, "success" | "warning" | "default" | "error"> = {
	active: "success",
	pending: "warning",
	unsubscribed: "default",
	bounced: "error",
	complained: "error",
};

const STATUS_HELP: Record<SubscriberStatus, string> = {
	active: "Confirmed, and sent every new post.",
	pending: "Signed up but hasn't clicked the confirmation link yet. Unconfirmed sign-ups are removed after 30 days.",
	unsubscribed: "Stopped their emails.",
	bounced: "SES reported a permanent bounce. Never emailed again.",
	complained: "Marked a post email as spam. Never emailed again.",
};

function Subscribers() {
	const search = route.useSearch();
	const navigate = useNavigate();
	const [query, setQuery] = useState(search.q ?? "");
	useEffect(() => setQuery(search.q ?? ""), [search.q]);

	const params = new URLSearchParams();
	if (search.status) params.set("status", search.status);
	if (search.q) params.set("q", search.q);
	if (search.page) params.set("page", String(search.page));
	const queryString = params.toString();

	const subscribers = useQuery({
		queryKey: ["subscribers", queryString],
		queryFn: () => api.get<SubscriberPage>(`/manage/api/subscribers${queryString ? `?${queryString}` : ""}`),
		placeholderData: keepPreviousData,
	});

	function go(next: SubscriberSearch) {
		navigate({ to: "/subscribers", search: next });
	}

	function applySearch(e: FormEvent) {
		e.preventDefault();
		go({ status: search.status, q: query.trim() || undefined });
	}

	const data = subscribers.data;
	const allCount = data ? SUBSCRIBER_STATUSES.reduce((sum, status) => sum + data.counts[status], 0) : 0;

	return (
		<Page>
			<PageHeader
				eyebrow="Readers"
				title={
					<Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
						<span>Subscribers</span>
						{data && <Chip label={`${data.counts.active.toLocaleString()} active`} size="small" color="success" />}
					</Stack>
				}
				subtitle="People who get new posts by email, newest sign-ups first."
			/>

			<Tabs
				value={search.status ?? "all"}
				onChange={(_event, value: string) => go({ status: value === "all" ? undefined : (value as SubscriberStatus), q: search.q })}
				variant="scrollable"
				allowScrollButtonsMobile
				sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
				aria-label="Subscriber status"
			>
				<Tab value="all" label={data ? `All (${allCount.toLocaleString()})` : "All"} />
				{SUBSCRIBER_STATUSES.map((status) => (
					<Tab
						key={status}
						value={status}
						label={data ? `${STATUS_LABELS[status]} (${data.counts[status].toLocaleString()})` : STATUS_LABELS[status]}
					/>
				))}
			</Tabs>

			{search.status && (
				<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
					{STATUS_HELP[search.status]}
				</Typography>
			)}

			<Box component="form" onSubmit={applySearch} sx={{ display: "flex", gap: 1.5, mb: 2, maxWidth: 520 }}>
				<TextField
					label="Email contains"
					placeholder="gmail.com"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					sx={{ flex: 1 }}
				/>
				<Button type="submit" variant="contained">
					Search
				</Button>
				{search.q && (
					<Button onClick={() => go({ status: search.status })}>Clear</Button>
				)}
			</Box>

			{subscribers.isError && (
				<Alert severity="error" sx={{ mb: 2 }}>
					{errorMessage(subscribers.error, "Couldn't load subscribers.")}
				</Alert>
			)}

			{subscribers.isPending && <Skeleton variant="rounded" height={320} />}

			{data && data.subscribers.length === 0 && (
				<Paper sx={{ p: 6, textAlign: "center" }}>
					<MailOutlined sx={{ fontSize: 48, color: "text.disabled" }} />
					<Typography variant="h2" sx={{ mt: 1 }}>
						{search.q || search.status ? "No matching subscribers" : "No subscribers yet"}
					</Typography>
					<Typography variant="body2" color="text.secondary">
						{search.q || search.status ? "Try another search or status." : "Sign-ups from the subscribe form will show up here."}
					</Typography>
				</Paper>
			)}

			{data && data.subscribers.length > 0 && (
				<Paper sx={{ overflow: "hidden" }}>
					<Box sx={{ height: 4 }}>{subscribers.isFetching && <LinearProgress />}</Box>
					<Box sx={{ overflowX: "auto" }}>
						<Table size="small">
							<TableHead>
								<TableRow>
									<TableCell>Email</TableCell>
									<TableCell>Status</TableCell>
									<TableCell>Signed up</TableCell>
									<TableCell>Confirmed</TableCell>
									<TableCell align="right">Posts sent</TableCell>
									<TableCell>Last post email</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{data.subscribers.map((subscriber) => (
									<TableRow key={subscriber.id} hover>
										<TableCell sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>{subscriber.email}</TableCell>
										<TableCell>
											<Chip
												size="small"
												variant="outlined"
												color={STATUS_COLORS[subscriber.status]}
												label={STATUS_LABELS[subscriber.status]}
											/>
										</TableCell>
										<TableCell sx={{ whiteSpace: "nowrap" }}>{formatDate(subscriber.created)}</TableCell>
										<TableCell sx={{ whiteSpace: "nowrap" }}>{subscriber.confirmed ? formatDate(subscriber.confirmed) : "—"}</TableCell>
										<TableCell align="right">{subscriber.emailsSent.toLocaleString()}</TableCell>
										<TableCell sx={{ whiteSpace: "nowrap" }}>{subscriber.lastSent ? formatDateTime(subscriber.lastSent) : "—"}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</Box>
					{data.totalPages > 1 && (
						<Stack
							direction="row"
							sx={{ alignItems: "center", justifyContent: "space-between", px: 2, py: 1.5, borderTop: 1, borderColor: "divider" }}
						>
							<Typography variant="body2" color="text.secondary">
								{data.total.toLocaleString()} subscribers · page <strong>{data.page}</strong> of <strong>{data.totalPages}</strong>
							</Typography>
							<Pagination
								count={data.totalPages}
								page={data.page}
								color="primary"
								shape="rounded"
								onChange={(_event, next) => go({ status: search.status, q: search.q, page: next > 1 ? next : undefined })}
							/>
						</Stack>
					)}
				</Paper>
			)}
		</Page>
	);
}

export function SubscribersPage() {
	return (
		<AdminOnly>
			<Subscribers />
		</AdminOnly>
	);
}
