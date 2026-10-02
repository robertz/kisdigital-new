import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Pagination from "@mui/material/Pagination";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Add from "@mui/icons-material/Add";
import ArticleOutlined from "@mui/icons-material/ArticleOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import Star from "@mui/icons-material/Star";
import StarBorder from "@mui/icons-material/StarBorder";
import { errorMessage } from "../../app/api";
import { isAdmin } from "../../app/boot";
import { ConfirmDialog } from "../../shared/ConfirmDialog";
import { Page, PageHeader } from "../../shared/Page";
import { StatusBadge } from "../../shared/StatusBadge";
import { formatLocalDate } from "../../shared/dates";
import { ButtonLink, IconButtonLink, TextLink } from "../../shared/links";
import { PostsTabs } from "./PostsTabs";
import { canDelete, postsApi, type PostPage, type PostSummary } from "./api";

const route = getRouteApi("/posts");

export function PostsPage() {
	const page = route.useSearch().page ?? 1;
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const queryKey = ["posts", page];
	const [deleting, setDeleting] = useState<PostSummary | null>(null);
	const [notice, setNotice] = useState("");

	const posts = useQuery({ queryKey, queryFn: () => postsApi.list(page), placeholderData: keepPreviousData });

	// The star flips immediately and is put back if the server refuses.
	const toggleFeatured = useMutation({
		mutationFn: (id: string) => postsApi.toggleFeatured(id),
		onMutate: async (id) => {
			await queryClient.cancelQueries({ queryKey });
			const previous = queryClient.getQueryData<PostPage>(queryKey);
			queryClient.setQueryData<PostPage>(queryKey, (data) =>
				data ? { ...data, posts: data.posts.map((p) => (p.id === id ? { ...p, featured: !p.featured } : p)) } : data,
			);
			return { previous };
		},
		onError: (_err, _id, context) => queryClient.setQueryData(queryKey, context?.previous),
		onSettled: () => queryClient.invalidateQueries({ queryKey: ["posts"] }),
	});

	const remove = useMutation({
		mutationFn: (post: PostSummary) => postsApi.remove(post.id),
		onSuccess: (_result, post) => {
			setDeleting(null);
			setNotice(`Deleted "${post.title}".`);
			queryClient.removeQueries({ queryKey: ["post", post.id] });
			queryClient.invalidateQueries({ queryKey: ["posts"] });
			queryClient.invalidateQueries({ queryKey: ["dashboard"] });
		},
		onError: () => setDeleting(null),
	});

	const data = posts.data;
	const newPost = (
		<ButtonLink to="/posts/new" variant="contained" startIcon={<Add />}>
			New post
		</ButtonLink>
	);

	return (
		<Page>
			<PageHeader
				eyebrow="Content"
				title={
					<Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
						<span>Posts</span>
						{data && <Chip label={data.total.toLocaleString()} size="small" />}
					</Stack>
				}
				subtitle="Draft, edit, publish, and feature blog posts."
				actions={newPost}
			/>

			<PostsTabs value="list" />

			<Stack spacing={2} sx={{ mb: 2 }}>
				{posts.isError && <Alert severity="error">{errorMessage(posts.error, "Couldn't load posts.")}</Alert>}
				{toggleFeatured.isError && (
					<Alert severity="error">{errorMessage(toggleFeatured.error, "Couldn't change the featured flag.")}</Alert>
				)}
				{remove.isError && <Alert severity="error">{errorMessage(remove.error, "Couldn't delete the post.")}</Alert>}
			</Stack>

			{posts.isPending && <Skeleton variant="rounded" height={320} />}

			{data && data.posts.length === 0 && (
				<Paper sx={{ p: 6, textAlign: "center" }}>
					<ArticleOutlined sx={{ fontSize: 48, color: "text.disabled" }} />
					<Typography variant="h2" sx={{ mt: 1 }}>
						No posts yet
					</Typography>
					<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
						Your first post is a button click away.
					</Typography>
					{newPost}
				</Paper>
			)}

			{data && data.posts.length > 0 && (
				<Paper sx={{ overflow: "hidden" }}>
					<Box sx={{ height: 4 }}>{posts.isFetching && <LinearProgress />}</Box>
					<TableContainer>
						<Table>
							<TableHead>
								<TableRow>
									<TableCell>Title</TableCell>
									<TableCell>Status</TableCell>
									<TableCell align="center">Featured</TableCell>
									<TableCell>Published</TableCell>
									<TableCell>Author</TableCell>
									<TableCell align="right">Views</TableCell>
									<TableCell align="right">Actions</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{data.posts.map((post) => (
									<TableRow key={post.id} hover>
										<TableCell sx={{ minWidth: 240 }}>
											<TextLink
												to="/posts/$postId/edit"
												params={{ postId: post.id }}
												underline="hover"
												color="text.primary"
												sx={{ fontWeight: 600 }}
											>
												{post.title}
											</TextLink>
											{post.tags.length > 0 && (
												<Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap", mt: 0.75 }}>
													{post.tags.map((tag) => (
														<Chip key={tag} label={tag} size="small" sx={{ height: 20, fontSize: "0.6875rem" }} />
													))}
												</Stack>
											)}
										</TableCell>
										<TableCell>
											<StatusBadge status={post.status} isScheduled={post.isScheduled} publishDate={post.publishDate} />
										</TableCell>
										<TableCell align="center">
											<Tooltip title={isAdmin ? (post.featured ? "Remove featured" : "Mark as featured") : ""}>
												<span>
													<IconButton
														size="small"
														disabled={!isAdmin}
														aria-label={post.featured ? "Remove featured" : "Mark as featured"}
														onClick={() => toggleFeatured.mutate(post.id)}
													>
														{post.featured ? <Star sx={{ color: "#f59e0b" }} /> : <StarBorder />}
													</IconButton>
												</span>
											</Tooltip>
										</TableCell>
										<TableCell sx={{ whiteSpace: "nowrap", color: "text.secondary" }}>
											{formatLocalDate(post.publishDate)}
										</TableCell>
										<TableCell sx={{ whiteSpace: "nowrap", color: "text.secondary" }}>{post.authorName}</TableCell>
										<TableCell align="right" sx={{ color: "text.secondary", fontVariantNumeric: "tabular-nums" }}>
											{post.views.toLocaleString()}
										</TableCell>
										<TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
											<Tooltip title="Edit">
												<IconButtonLink
													to="/posts/$postId/edit"
													params={{ postId: post.id }}
													size="small"
													aria-label={`Edit ${post.title}`}
												>
													<EditOutlined fontSize="small" />
												</IconButtonLink>
											</Tooltip>
											{canDelete(post) && (
												<Tooltip title="Delete permanently">
													<IconButton
														size="small"
														color="error"
														aria-label={`Delete ${post.title}`}
														onClick={() => setDeleting(post)}
													>
														<DeleteOutline fontSize="small" />
													</IconButton>
												</Tooltip>
											)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</TableContainer>

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
								onChange={(_event, next) => navigate({ to: "/posts", search: next > 1 ? { page: next } : {} })}
							/>
						</Stack>
					)}
				</Paper>
			)}

			<ConfirmDialog
				open={deleting !== null}
				title="Delete this post?"
				confirmLabel="Delete permanently"
				busy={remove.isPending}
				onClose={() => setDeleting(null)}
				onConfirm={() => deleting && remove.mutate(deleting)}
			>
				"{deleting?.title}" will be permanently deleted, along with its comments and view counts. This can't be undone.
			</ConfirmDialog>

			<Snackbar open={notice !== ""} autoHideDuration={5000} onClose={() => setNotice("")} message={notice} />
		</Page>
	);
}
