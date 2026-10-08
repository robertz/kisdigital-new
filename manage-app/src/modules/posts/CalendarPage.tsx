import { useState, type DragEvent } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import type { Theme } from "@mui/material/styles";
import Add from "@mui/icons-material/Add";
import ChevronLeft from "@mui/icons-material/ChevronLeft";
import ChevronRight from "@mui/icons-material/ChevronRight";
import { errorMessage } from "../../app/api";
import { ConfirmDialog } from "../../shared/ConfirmDialog";
import { Page, PageHeader } from "../../shared/Page";
import { ButtonLink, TextLink } from "../../shared/links";
import { PostsTabs } from "./PostsTabs";
import { toLocalInput } from "../../shared/dates";
import { postsApi, type CalendarPost } from "./api";

const route = getRouteApi("/posts/calendar");
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Dragged {
	id: string;
	title: string;
	// The day it's on now and when it publishes; absent for a draft.
	from?: string;
	publishDate?: string;
}

function pad(n: number): string {
	return String(n).padStart(2, "0");
}

function monthOf(date: Date): string {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function shift(month: string, by: number): string {
	const [year, m] = month.split("-").map(Number);
	return monthOf(new Date(year, m - 1 + by, 1));
}

function timeOf(publishDate: string): string {
	return new Date(publishDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// The new publish date for a post dropped on a day: a scheduled post keeps
// its time of day, and a draft goes out at 9:00, both in local time.
function publishDateFor(item: Dragged, day: string): string {
	const [y, m, d] = day.split("-").map(Number);
	const current = item.publishDate ? new Date(item.publishDate) : null;
	return new Date(y, m - 1, d, current ? current.getHours() : 9, current ? current.getMinutes() : 0).toISOString();
}

function chipColor(post: CalendarPost): "info" | "success" | "default" {
	if (post.isScheduled) return "info";
	return post.status === "published" ? "success" : "default";
}

function PostChip({ post, onDragStart }: { post: CalendarPost; onDragStart?: (e: DragEvent) => void }) {
	const color = chipColor(post);
	return (
		<Tooltip title={`${post.title} · ${post.isScheduled ? "Scheduled" : post.status === "published" ? "Published" : "Archived"} ${timeOf(post.publishDate)}`}>
			<TextLink
				to="/posts/$postId/edit"
				params={{ postId: post.id }}
				underline="none"
				draggable={Boolean(onDragStart)}
				onDragStart={onDragStart}
				sx={{
					display: "block",
					px: 0.75,
					py: 0.25,
					borderRadius: 1,
					fontSize: "0.75rem",
					fontWeight: 600,
					lineHeight: 1.5,
					whiteSpace: "nowrap",
					overflow: "hidden",
					textOverflow: "ellipsis",
					color: color === "default" ? "text.secondary" : `${color}.main`,
					border: 1,
					borderColor: color === "default" ? "divider" : `${color}.main`,
					cursor: onDragStart ? "grab" : "pointer",
				}}
			>
				{post.title}
			</TextLink>
		</Tooltip>
	);
}

export function CalendarPage() {
	const today = new Date();
	const month = route.useSearch().month ?? monthOf(today);
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const narrow = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
	const [dragged, setDragged] = useState<Dragged | null>(null);
	const [overDay, setOverDay] = useState<string | null>(null);
	const [pending, setPending] = useState<{ item: Dragged; day: string } | null>(null);

	const [year, monthNumber] = month.split("-").map(Number);
	const calendar = useQuery({
		queryKey: ["calendar", month],
		queryFn: () =>
			postsApi.calendar(month, new Date(year, monthNumber - 1, 1).toISOString(), new Date(year, monthNumber, 1).toISOString()),
		placeholderData: keepPreviousData,
	});

	const schedule = useMutation({
		mutationFn: ({ item, day }: { item: Dragged; day: string }) => postsApi.schedule(item.id, publishDateFor(item, day)),
		onSettled: () => {
			setPending(null);
			queryClient.invalidateQueries({ queryKey: ["calendar"] });
			queryClient.invalidateQueries({ queryKey: ["posts"] });
			queryClient.invalidateQueries({ queryKey: ["dashboard"] });
		},
	});

	const first = new Date(year, monthNumber - 1, 1);
	const daysInMonth = new Date(year, monthNumber, 0).getDate();
	const todayKey = `${monthOf(today)}-${pad(today.getDate())}`;
	const title = first.toLocaleDateString("en-US", { month: "long", year: "numeric" });

	const byDay = new Map<string, CalendarPost[]>();
	for (const post of calendar.data?.posts ?? []) {
		const key = toLocalInput(post.publishDate).slice(0, 10);
		byDay.set(key, [...(byDay.get(key) ?? []), post]);
	}

	const days = Array.from({ length: daysInMonth }, (_, i) => `${month}-${pad(i + 1)}`);
	const cells: (string | null)[] = [...Array.from({ length: first.getDay() }, () => null), ...days];
	while (cells.length % 7 !== 0) cells.push(null);

	function go(next: string) {
		navigate({ to: "/posts/calendar", search: next === monthOf(today) ? {} : { month: next } });
	}

	function startDrag(e: DragEvent, item: Dragged) {
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("text/plain", item.title);
		setDragged(item);
	}

	function drop(day: string) {
		setOverDay(null);
		if (!dragged || dragged.from === day) return setDragged(null);
		setPending({ item: dragged, day });
		setDragged(null);
	}

	// A day that has already passed can't be scheduled into.
	const droppable = (day: string) => dragged !== null && day >= todayKey;

	function dayLabel(day: string): string {
		const [y, m, d] = day.split("-").map(Number);
		return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
	}

	return (
		<Page>
			<PageHeader
				eyebrow="Content"
				title="Posts"
				subtitle="What has been published and what is scheduled, by day."
				actions={
					<ButtonLink to="/posts/new" variant="contained" startIcon={<Add />}>
						New post
					</ButtonLink>
				}
			/>
			<PostsTabs value="calendar" />

			<Stack spacing={2} sx={{ mb: 2 }}>
				{calendar.isError && <Alert severity="error">{errorMessage(calendar.error, "Couldn't load the calendar.")}</Alert>}
				{schedule.isError && <Alert severity="error">{errorMessage(schedule.error, "Couldn't schedule that post.")}</Alert>}
			</Stack>

			<Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 1fr) 260px" } }}>
				<Paper sx={{ overflow: "hidden" }}>
					<Stack direction="row" spacing={1} sx={{ alignItems: "center", px: 2, py: 1.5 }}>
						<Typography variant="h2" sx={{ flex: 1 }}>
							{title}
						</Typography>
						<Button size="small" color="inherit" disabled={month === monthOf(today)} onClick={() => go(monthOf(today))}>
							Today
						</Button>
						<IconButton aria-label="Previous month" onClick={() => go(shift(month, -1))}>
							<ChevronLeft />
						</IconButton>
						<IconButton aria-label="Next month" onClick={() => go(shift(month, 1))}>
							<ChevronRight />
						</IconButton>
					</Stack>
					<Box sx={{ height: 4 }}>{calendar.isFetching && <LinearProgress />}</Box>

					{calendar.isPending && <Skeleton variant="rectangular" height={420} />}

					{calendar.data && !narrow && (
						<Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", borderTop: 1, borderColor: "divider" }}>
							{WEEKDAYS.map((name) => (
								<Typography key={name} variant="overline" color="text.secondary" sx={{ px: 1, py: 0.5, borderBottom: 1, borderColor: "divider" }}>
									{name}
								</Typography>
							))}
							{cells.map((day, i) => (
								<Box
									key={day ?? `blank-${i}`}
									onDragOver={(e) => {
										if (!day || !droppable(day)) return;
										e.preventDefault();
										setOverDay(day);
									}}
									onDragLeave={() => setOverDay((current) => (current === day ? null : current))}
									onDrop={(e) => {
										if (!day || !droppable(day)) return;
										e.preventDefault();
										drop(day);
									}}
									sx={{
										minHeight: 112,
										p: 0.75,
										borderRight: (i + 1) % 7 === 0 ? 0 : 1,
										borderBottom: i >= cells.length - 7 ? 0 : 1,
										borderColor: "divider",
										bgcolor: !day ? "background.default" : overDay === day ? "action.hover" : "transparent",
										opacity: day && dragged && !droppable(day) ? 0.45 : 1,
									}}
								>
									{day && (
										<>
											<Typography
												variant="caption"
												sx={{
													display: "inline-flex",
													alignItems: "center",
													justifyContent: "center",
													minWidth: 22,
													height: 22,
													mb: 0.5,
													borderRadius: "50%",
													fontWeight: 600,
													color: day === todayKey ? "primary.contrastText" : "text.secondary",
													bgcolor: day === todayKey ? "primary.main" : "transparent",
												}}
											>
												{Number(day.slice(8))}
											</Typography>
											<Stack spacing={0.5}>
												{(byDay.get(day) ?? []).map((post) => (
													<PostChip
														key={post.id}
														post={post}
														onDragStart={post.isScheduled ? (e) => startDrag(e, { id: post.id, title: post.title, from: day, publishDate: post.publishDate }) : undefined}
													/>
												))}
											</Stack>
										</>
									)}
								</Box>
							))}
						</Box>
					)}

					{calendar.data && narrow && (
						<Stack sx={{ borderTop: 1, borderColor: "divider" }}>
							{days.filter((day) => byDay.has(day)).length === 0 && (
								<Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
									Nothing published or scheduled this month.
								</Typography>
							)}
							{days
								.filter((day) => byDay.has(day))
								.map((day) => (
									<Box key={day} sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "divider" }}>
										<Typography variant="overline" color={day === todayKey ? "primary" : "text.secondary"}>
											{dayLabel(day)}
										</Typography>
										<Stack spacing={0.5} sx={{ mt: 0.5 }}>
											{byDay.get(day)!.map((post) => (
												<PostChip key={post.id} post={post} />
											))}
										</Stack>
									</Box>
								))}
						</Stack>
					)}
				</Paper>

				<Paper sx={{ p: 2 }}>
					<Typography variant="h3" sx={{ mb: 0.5 }}>
						Drafts
					</Typography>
					<Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
						{narrow ? "Open a draft to set its publish date." : "Drag a draft onto a day to schedule it for 9:00 AM. Drag a scheduled post to move it."}
					</Typography>
					{calendar.data && calendar.data.drafts.length === 0 && (
						<Typography variant="body2" color="text.secondary">
							No drafts.
						</Typography>
					)}
					<Stack spacing={0.75}>
						{calendar.data?.drafts.map((draft) => (
							<TextLink
								key={draft.id}
								to="/posts/$postId/edit"
								params={{ postId: draft.id }}
								underline="none"
								draggable={!narrow}
								onDragStart={(e: DragEvent) => startDrag(e, { id: draft.id, title: draft.title })}
								sx={{
									display: "block",
									px: 1,
									py: 0.75,
									borderRadius: 1,
									border: 1,
									borderColor: "divider",
									color: "text.primary",
									fontSize: "0.8125rem",
									fontWeight: 600,
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
									cursor: narrow ? "pointer" : "grab",
									"&:hover": { borderColor: "warning.main" },
								}}
							>
								{draft.title}
							</TextLink>
						))}
					</Stack>
				</Paper>
			</Box>

			<ConfirmDialog
				open={pending !== null}
				title={pending?.item.from ? "Move this post?" : "Schedule this draft?"}
				confirmLabel={pending?.item.from ? "Move" : "Schedule"}
				confirmColor="primary"
				busy={schedule.isPending}
				onClose={() => setPending(null)}
				onConfirm={() => pending && schedule.mutate({ item: pending.item, day: pending.day })}
			>
				{pending?.item.from
					? `"${pending.item.title}" will go live on ${pending ? dayLabel(pending.day) : ""} instead, at the same time of day.`
					: `"${pending?.item.title}" will be published automatically on ${pending ? dayLabel(pending.day) : ""} at 9:00 AM.`}
			</ConfirmDialog>
		</Page>
	);
}
