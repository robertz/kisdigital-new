import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Link from "@mui/material/Link";
import Pagination from "@mui/material/Pagination";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ChatOutlined from "@mui/icons-material/ChatOutlined";
import Check from "@mui/icons-material/Check";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import Public from "@mui/icons-material/Public";
import Reply from "@mui/icons-material/Reply";
import { api, errorMessage } from "../../app/api";
import { AdminOnly } from "../../shared/AdminOnly";
import { ConfirmDialog } from "../../shared/ConfirmDialog";
import { Page, PageHeader } from "../../shared/Page";
import { formatDateTime } from "../../shared/dates";

interface Comment {
	id: string;
	postTitle: string;
	postUrl: string;
	isReply: boolean;
	isRemote: boolean;
	authorName: string;
	authorEmail: string;
	remoteUrl: string;
	body: string;
	isDeleted: boolean;
	isPending: boolean;
	created: string;
}

interface CommentPage {
	comments: Comment[];
	total: number;
	pending: number;
	page: number;
	totalPages: number;
}

const route = getRouteApi("/comments");

function CommentRow({ comment, onApprove, onDelete, busy }: { comment: Comment; onApprove: () => void; onDelete: () => void; busy: boolean }) {
	return (
		<Stack
			direction={{ xs: "column", sm: "row" }}
			spacing={2}
			sx={{ p: 2, borderBottom: 1, borderColor: "divider", "&:last-of-type": { borderBottom: 0 }, opacity: comment.isDeleted ? 0.6 : 1 }}
		>
			<Box sx={{ flex: 1, minWidth: 0 }}>
				<Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap", mb: 0.75 }}>
					{comment.isPending && <Chip size="small" color="warning" variant="outlined" label="Pending" />}
					{comment.isDeleted && <Chip size="small" variant="outlined" label="Deleted" />}
					{comment.isRemote && (
						<Tooltip title="Reply from the fediverse">
							<Public fontSize="small" color="action" />
						</Tooltip>
					)}
					{comment.isReply && (
						<Tooltip title="Reply">
							<Reply fontSize="small" color="action" />
						</Tooltip>
					)}
					<Typography variant="body2" sx={{ fontWeight: 600 }}>
						{comment.authorName || "Unknown"}
					</Typography>
					{comment.authorEmail &&
						(comment.isRemote && comment.remoteUrl ? (
							<Link href={comment.remoteUrl} target="_blank" rel="nofollow noopener" variant="caption" color="text.secondary">
								{comment.authorEmail}
							</Link>
						) : (
							<Typography variant="caption" color="text.secondary">
								{comment.authorEmail}
							</Typography>
						))}
				</Stack>
				{!comment.isDeleted && (
					<Typography variant="body2" sx={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>
						{comment.body.length > 400 ? `${comment.body.slice(0, 400)}…` : comment.body}
					</Typography>
				)}
				<Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
					On{" "}
					<Link href={comment.postUrl} target="_blank" rel="noopener" color="inherit" underline="hover" sx={{ fontWeight: 600 }}>
						{comment.postTitle}
					</Link>{" "}
					· {formatDateTime(comment.created)}
				</Typography>
			</Box>
			<Stack direction="row" spacing={0.5} sx={{ alignItems: "flex-start" }}>
				{comment.isPending && (
					<Tooltip
						title={
							comment.isRemote
								? "Approve (and trust this account from now on)"
								: "Approve (and send it to the fediverse as the blog)"
						}
					>
						<span>
							<IconButton color="success" aria-label="Approve comment" disabled={busy} onClick={onApprove}>
								<Check />
							</IconButton>
						</span>
					</Tooltip>
				)}
				{!comment.isDeleted && (
					<Tooltip title="Delete comment">
						<span>
							<IconButton color="error" aria-label="Delete comment" disabled={busy} onClick={onDelete}>
								<DeleteOutlined />
							</IconButton>
						</span>
					</Tooltip>
				)}
			</Stack>
		</Stack>
	);
}

function Comments() {
	const page = route.useSearch().page ?? 1;
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [deleting, setDeleting] = useState<Comment | null>(null);

	const comments = useQuery({
		queryKey: ["comments", page],
		queryFn: () => api.get<CommentPage>(`/manage/api/comments?page=${page}`),
		placeholderData: keepPreviousData,
	});

	function refresh() {
		queryClient.invalidateQueries({ queryKey: ["comments"] });
		queryClient.invalidateQueries({ queryKey: ["dashboard"] });
	}

	const approve = useMutation({
		mutationFn: (id: string) => api.post(`/manage/api/comments/${encodeURIComponent(id)}/approve`),
		onSettled: refresh,
	});
	const remove = useMutation({
		mutationFn: (id: string) => api.delete(`/manage/api/comments/${encodeURIComponent(id)}`),
		onSettled: () => {
			setDeleting(null);
			refresh();
		},
	});

	const data = comments.data;

	return (
		<Page>
			<PageHeader
				eyebrow="Content"
				title={
					<Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
						<span>Comments</span>
						{data && <Chip label={data.total.toLocaleString()} size="small" />}
						{data && data.pending > 0 && <Chip label={`${data.pending} pending`} size="small" color="warning" />}
					</Stack>
				}
				subtitle="All comments across every post. Pending ones come first, then newest first."
			/>

			<Alert severity="info" sx={{ mb: 2 }}>
				Replies from the fediverse wait as pending until you approve one from that account; after that, the account's
				replies publish immediately. Replies by anyone else in a fediverse thread also wait here, and go out to the
				fediverse as the blog's account once approved.
			</Alert>

			<Stack spacing={2} sx={{ mb: 2 }}>
				{comments.isError && <Alert severity="error">{errorMessage(comments.error, "Couldn't load comments.")}</Alert>}
				{approve.isError && <Alert severity="error">{errorMessage(approve.error, "Couldn't approve the comment.")}</Alert>}
				{remove.isError && <Alert severity="error">{errorMessage(remove.error, "Couldn't delete the comment.")}</Alert>}
			</Stack>

			{comments.isPending && <Skeleton variant="rounded" height={320} />}

			{data && data.comments.length === 0 && (
				<Paper sx={{ p: 6, textAlign: "center" }}>
					<ChatOutlined sx={{ fontSize: 48, color: "text.disabled" }} />
					<Typography variant="h2" sx={{ mt: 1 }}>
						No comments yet
					</Typography>
					<Typography variant="body2" color="text.secondary">
						Comments left on posts will show up here.
					</Typography>
				</Paper>
			)}

			{data && data.comments.length > 0 && (
				<Paper sx={{ overflow: "hidden" }}>
					<Box sx={{ height: 4 }}>{comments.isFetching && <LinearProgress />}</Box>
					{data.comments.map((comment) => (
						<CommentRow
							key={comment.id}
							comment={comment}
							busy={approve.isPending || remove.isPending}
							onApprove={() => approve.mutate(comment.id)}
							onDelete={() => setDeleting(comment)}
						/>
					))}
					{data.totalPages > 1 && (
						<Stack
							direction="row"
							sx={{ alignItems: "center", justifyContent: "space-between", px: 2, py: 1.5, borderTop: 1, borderColor: "divider" }}
						>
							<Typography variant="body2" color="text.secondary">
								Page <strong>{data.page}</strong> of <strong>{data.totalPages}</strong>
							</Typography>
							<Pagination
								count={data.totalPages}
								page={data.page}
								color="primary"
								shape="rounded"
								onChange={(_event, next) => navigate({ to: "/comments", search: next > 1 ? { page: next } : {} })}
							/>
						</Stack>
					)}
				</Paper>
			)}

			<ConfirmDialog
				open={deleting !== null}
				title="Delete this comment?"
				confirmLabel="Delete"
				busy={remove.isPending}
				onClose={() => setDeleting(null)}
				onConfirm={() => deleting && remove.mutate(deleting.id)}
			>
				The comment by {deleting?.authorName || "this person"} will be removed from the post. This can't be undone.
			</ConfirmDialog>
		</Page>
	);
}

export function CommentsPage() {
	return (
		<AdminOnly>
			<Comments />
		</AdminOnly>
	);
}
