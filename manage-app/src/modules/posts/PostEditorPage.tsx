import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useBlocker, useNavigate } from "@tanstack/react-router";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import InputBase from "@mui/material/InputBase";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import type { Theme } from "@mui/material/styles";
import ArrowBack from "@mui/icons-material/ArrowBack";
import Close from "@mui/icons-material/Close";
import Code from "@mui/icons-material/Code";
import DeleteOutline from "@mui/icons-material/DeleteOutlined";
import FormatBold from "@mui/icons-material/FormatBold";
import FormatItalic from "@mui/icons-material/FormatItalic";
import FormatListBulleted from "@mui/icons-material/FormatListBulleted";
import FormatListNumbered from "@mui/icons-material/FormatListNumbered";
import FormatQuote from "@mui/icons-material/FormatQuote";
import HistoryOutlined from "@mui/icons-material/HistoryOutlined";
import ImageOutlined from "@mui/icons-material/ImageOutlined";
import InsertLink from "@mui/icons-material/InsertLink";
import OpenInNew from "@mui/icons-material/OpenInNew";
import PhotoLibraryOutlined from "@mui/icons-material/PhotoLibraryOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import Title from "@mui/icons-material/Title";
import TuneOutlined from "@mui/icons-material/TuneOutlined";
import UploadOutlined from "@mui/icons-material/UploadOutlined";
import { errorMessage } from "../../app/api";
import { ConfirmDialog } from "../../shared/ConfirmDialog";
import { ImageCropper } from "../../shared/ImageCropper";
import { ImagePicker } from "../../shared/ImagePicker";
import { Page } from "../../shared/Page";
import { StatusBadge } from "../../shared/StatusBadge";
import { ButtonLink, IconButtonLink } from "../../shared/links";
import { fromLocalInput, localZoneLabel, toLocalInput } from "../../shared/dates";
import { uploadImage, uploadPath } from "../../shared/media";
import { HistoryDrawer } from "./HistoryDrawer";
import { MarkdownEditor, type MarkdownEditorHandle } from "./MarkdownEditor";
import { FormatToolbar, PostEditorContent, insertImage, usePostEditor } from "./richtext/RichTextEditor";
import { survivesVisualEditing } from "./richtext/roundTrip";
import { canDelete, postsApi, type Post, type PostInput, type Revision } from "./api";
import { useLocalDraft } from "./useLocalDraft";

interface Draft {
	title: string;
	slug: string;
	description: string;
	body: string;
	status: string;
	publishDate: string;
	featured: boolean;
	coverImage: string;
	tags: string[];
}

type Mode = "visual" | "markdown" | "preview";

const HEADER_HEIGHT = "var(--site-padding-top, 64px)";
const MODE_KEY = "kisdigital:manage:body-editor";
const SETTINGS_KEY = "kisdigital:manage:post-settings";

function toDraft(post: Post | null): Draft {
	return {
		title: post?.title ?? "",
		slug: post?.slug ?? "",
		description: post?.description ?? "",
		body: post?.body ?? "",
		status: post?.status ?? "draft",
		publishDate: toLocalInput(post?.publishDate ?? ""),
		featured: post?.featured ?? false,
		coverImage: post?.coverImage ?? "",
		tags: post?.tags ?? [],
	};
}

// The editor holds the publish date in local time; the server keeps UTC.
function toInput(draft: Draft): PostInput {
	return { ...draft, publishDate: fromLocalInput(draft.publishDate) };
}

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function readStored(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

function writeStored(key: string, value: string) {
	try {
		localStorage.setItem(key, value);
	} catch {}
}

function useDebounced<T>(value: T, delay: number): T {
	const [debounced, setDebounced] = useState(value);
	useEffect(() => {
		const timer = window.setTimeout(() => setDebounced(value), delay);
		return () => window.clearTimeout(timer);
	}, [value, delay]);
	return debounced;
}

// A pasted screenshot always arrives as "image.png". Uploads are keyed by
// filename and overwrite on a match, so without a unique name every paste
// would replace the previous one in every post that used it.
function withUniquePastedName(file: File): File {
	if (!/^image\.\w+$/i.test(file.name)) return file;
	const ext = file.name.split(".").pop();
	return new File([file], `pasted-${Date.now()}.${ext}`, { type: file.type });
}

function useElementHeight<T extends HTMLElement>(): [(el: T | null) => void, number] {
	const [el, setEl] = useState<T | null>(null);
	const [height, setHeight] = useState(0);
	useEffect(() => {
		if (!el) return;
		const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
		observer.observe(el);
		return () => observer.disconnect();
	}, [el]);
	return [setEl, height];
}

function PostEditor({ post }: { post: Post | null }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const markdownEditor = useRef<MarkdownEditorHandle>(null);
	const coverFile = useRef<HTMLInputElement>(null);
	const leaving = useRef(false);
	const wide = useMediaQuery((theme: Theme) => theme.breakpoints.up("lg"));
	const [setBarRef, barHeight] = useElementHeight<HTMLElement>();

	const [saved, setSaved] = useState(post);
	const [synced, setSynced] = useState(() => toDraft(post));
	const [draft, setDraft] = useState(synced);
	const [slugLocked, setSlugLocked] = useState(synced.slug.length > 0);
	const [flash, setFlash] = useState<{ kind: "success" | "error"; text: string } | null>(null);
	// The last success message, kept while its toast fades out.
	const [toastText, setToastText] = useState("");
	useEffect(() => {
		if (flash?.kind === "success") setToastText(flash.text);
	}, [flash]);
	const [mode, setMode] = useState<Mode>(() => (readStored(MODE_KEY) === "markdown" ? "markdown" : "visual"));
	// Set when the visual editor would rewrite parts of this body it can't hold.
	const [lossy, setLossy] = useState(false);
	// Beside the editor on a wide screen, where it stays as left; over it on a
	// narrow one, where it starts closed.
	const [sideOpen, setSideOpen] = useState(() => readStored(SETTINGS_KEY) !== "0");
	const [drawerOpen, setDrawerOpen] = useState(false);
	const settingsOpen = wide ? sideOpen : drawerOpen;
	const [picker, setPicker] = useState<"cover" | "insert" | null>(null);
	const [pickerOpen, setPickerOpen] = useState(false);
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const [croppingCover, setCroppingCover] = useState<File | null>(null);
	const [historyOpen, setHistoryOpen] = useState(false);
	const [serverSavedAt, setServerSavedAt] = useState<number | null>(null);
	const [uploads, setUploads] = useState(0);
	const [coverStatus, setCoverStatus] = useState<{ text: string; error: boolean } | null>(null);

	const local = useLocalDraft(`kisdigital:manage:post-draft:${post?.id ?? "new"}`, draft, synced);
	const allTags = useQuery({ queryKey: ["tags"], queryFn: postsApi.tags });

	function update(patch: Partial<Draft>) {
		setDraft((current) => ({ ...current, ...patch }));
	}

	async function uploadBodyImage(file: File): Promise<string> {
		setUploads((n) => n + 1);
		try {
			return await uploadImage(withUniquePastedName(file), uploadPath());
		} catch (err) {
			setFlash({ kind: "error", text: errorMessage(err, "Image upload failed.") });
			throw err;
		} finally {
			setUploads((n) => n - 1);
		}
	}

	const editor = usePostEditor({
		value: draft.body,
		onChange: (body) => update({ body }),
		placeholder: "Tell your story…",
		upload: uploadBodyImage,
		active: mode === "visual",
	});

	// A body the visual editor can't hold exactly opens as Markdown, once.
	const checked = useRef(false);
	useEffect(() => {
		if (!editor || checked.current) return;
		checked.current = true;
		if (mode === "visual" && !survivesVisualEditing(editor, draft.body)) {
			setMode("markdown");
			setLossy(true);
		}
	}, [editor, mode, draft.body]);

	const previewBody = useDebounced(draft.body, 400);
	const preview = useQuery({
		queryKey: ["preview", previewBody],
		queryFn: () => postsApi.preview(previewBody),
		enabled: mode === "preview",
		placeholderData: keepPreviousData,
		staleTime: Infinity,
		gcTime: 60_000,
	});

	const save = useMutation({
		mutationFn: (submitted: Draft) =>
			saved ? postsApi.update(saved.id, toInput(submitted)) : postsApi.create(toInput(submitted)),
		onSuccess: (result, submitted) => {
			local.clear();
			setServerSavedAt(null);
			queryClient.invalidateQueries({ queryKey: ["revisions", result.id] });
			queryClient.setQueryData(["post", result.id], result);
			queryClient.invalidateQueries({ queryKey: ["posts"] });
			queryClient.invalidateQueries({ queryKey: ["dashboard"] });
			queryClient.invalidateQueries({ queryKey: ["tags"] });

			if (!saved) {
				leaving.current = true;
				navigate({ to: "/posts/$postId/edit", params: { postId: result.id }, replace: true });
				return;
			}

			// The server fills in a blank slug and a blank publish date. Those
			// two are taken from its answer, unless they were edited again
			// while the save was in flight.
			const publishDate = toLocalInput(result.publishDate);
			setSynced({ ...submitted, slug: result.slug, publishDate });
			setDraft((current) => ({
				...current,
				slug: current.slug === submitted.slug ? result.slug : current.slug,
				publishDate: current.publishDate === submitted.publishDate ? publishDate : current.publishDate,
			}));
			setSlugLocked(true);
			setSaved(result);
			setFlash({ kind: "success", text: "Post saved." });
		},
		onError: (err) => setFlash({ kind: "error", text: errorMessage(err, "Couldn't save the post.") }),
	});

	// Offered on the saved status, not the one picked in the form, so a
	// published post has to be saved as a draft or archived first.
	const remove = useMutation({
		mutationFn: (id: string) => postsApi.remove(id),
		onSuccess: (_result, id) => {
			local.clear();
			queryClient.removeQueries({ queryKey: ["post", id] });
			queryClient.invalidateQueries({ queryKey: ["posts"] });
			queryClient.invalidateQueries({ queryKey: ["dashboard"] });
			leaving.current = true;
			navigate({ to: "/posts" });
		},
		onError: (err) => {
			setConfirmingDelete(false);
			setFlash({ kind: "error", text: errorMessage(err, "Couldn't delete the post.") });
		},
	});

	// While there are unsaved changes to a saved post, a copy goes to the
	// server once a minute. It doesn't change the post; it shows up at the
	// top of History, so the work can be picked up on another device.
	const latestDraft = useRef(draft);
	latestDraft.current = draft;
	const savedId = saved?.id;
	useEffect(() => {
		if (!savedId || !local.dirty) return;
		const timer = window.setInterval(() => {
			postsApi
				.autosave(savedId, toInput(latestDraft.current))
				.then((stored) => {
					if (stored) setServerSavedAt(Date.now());
				})
				.catch(() => {});
		}, 60_000);
		return () => window.clearInterval(timer);
	}, [savedId, local.dirty]);

	function restoreRevision(revision: Revision) {
		update({
			title: revision.title,
			description: revision.description,
			coverImage: revision.coverImage,
			body: revision.body,
			tags: revision.tags,
		});
		setHistoryOpen(false);
		setFlash({ kind: "success", text: "Version restored into the editor. Save to keep it." });
	}

	function submit() {
		if (save.isPending) return;
		if (!draft.title.trim()) {
			setFlash({ kind: "error", text: "Title is required." });
			return;
		}
		setFlash(null);
		save.mutate(draft);
	}

	const submitRef = useRef(submit);
	submitRef.current = submit;

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && e.key === "s") {
				e.preventDefault();
				submitRef.current();
			}
		}
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, []);

	useBlocker({
		shouldBlockFn: () =>
			local.dirty &&
			!leaving.current &&
			!window.confirm("You have unsaved changes. A copy is kept on this device. Leave the editor?"),
		enableBeforeUnload: () => local.dirty && !leaving.current,
	});

	function changeMode(next: Mode) {
		if (next === "visual" && editor) setLossy(!survivesVisualEditing(editor, draft.body));
		if (next !== "preview") writeStored(MODE_KEY, next);
		setMode(next);
	}

	function toggleSettings() {
		if (!wide) {
			setDrawerOpen((open) => !open);
			return;
		}
		setSideOpen((open) => {
			writeStored(SETTINGS_KEY, open ? "0" : "1");
			return !open;
		});
	}

	// A cover is cropped to the shape the site shows it in before it's
	// uploaded. GIFs skip that: a canvas would drop their animation.
	function chooseCover(file: File | undefined) {
		if (coverFile.current) coverFile.current.value = "";
		if (!file) return;
		if (file.type === "image/gif") uploadCover(file);
		else setCroppingCover(file);
	}

	async function uploadCover(file: File | undefined) {
		if (!file) return;
		setCoverStatus({ text: "Uploading cover…", error: false });
		try {
			update({ coverImage: await uploadImage(file, uploadPath()) });
			setCoverStatus(null);
		} catch (err) {
			setCoverStatus({ text: errorMessage(err, "Upload failed. Check your connection and try again."), error: true });
		} finally {
			if (coverFile.current) coverFile.current.value = "";
		}
	}

	function pickImage(url: string, filename: string, alt: string) {
		const text = alt || filename.replace(/\.[^.]+$/, "");
		if (picker === "insert") {
			if (mode === "visual" && editor) insertImage(editor, url, text);
			else markdownEditor.current?.insertAtCursor(`![${text}](${url})`);
		} else {
			update({ coverImage: url });
			setCoverStatus(null);
		}
		setPickerOpen(false);
	}

	function openPicker(kind: "cover" | "insert") {
		setPicker(kind);
		setPickerOpen(true);
	}

	const words = draft.body.trim() ? draft.body.trim().split(/\s+/).length : 0;
	const readingMinutes = Math.max(1, Math.ceil(words / 200));
	const isLive = saved?.status === "published" && !saved.isScheduled;

	let statusText = "";
	if (save.isPending) statusText = "Saving…";
	else if (uploads) statusText = uploads > 1 ? `Uploading ${uploads} images…` : "Uploading image…";
	else if (local.dirty)
		statusText = serverSavedAt
			? "Unsaved changes, backed up to the server"
			: local.savedAt
				? "Unsaved changes, kept on this device"
				: "Unsaved changes";
	else if (saved) statusText = "All changes saved";

	const settings = (
		<SettingsPanel
			draft={draft}
			saved={saved}
			tags={allTags.data ?? []}
			slugLocked={slugLocked}
			deleting={remove.isPending || save.isPending}
			onUpdate={update}
			onSlug={(slug) => {
				setSlugLocked(true);
				update({ slug });
			}}
			onDelete={() => setConfirmingDelete(true)}
			onClose={wide ? undefined : toggleSettings}
		/>
	);

	const sidePadding = { xs: 2.5, sm: 5 };

	return (
		<Page flush>
			<Box
				component="form"
				onSubmit={(e: FormEvent) => {
					e.preventDefault();
					submit();
				}}
			>
				<Paper
					ref={setBarRef}
					square
					component="header"
					sx={{
						position: "sticky",
						top: HEADER_HEIGHT,
						zIndex: 11,
						border: 0,
						borderBottom: 1,
						borderColor: "divider",
						px: { xs: 1.5, sm: 3 },
						py: 1,
						display: "flex",
						alignItems: "center",
						gap: 1,
					}}
				>
					<Tooltip title="Back to posts">
						<IconButtonLink to="/posts" aria-label="Back to posts">
							<ArrowBack />
						</IconButtonLink>
					</Tooltip>
					<Stack direction="row" spacing={1.5} sx={{ flex: 1, minWidth: 0, alignItems: "center" }}>
						<Typography variant="subtitle2" noWrap sx={{ display: { xs: "none", sm: "block" } }}>
							{saved ? "Edit post" : "New post"}
						</Typography>
						<StatusBadge status={saved?.status ?? "draft"} isScheduled={saved?.isScheduled} publishDate={saved?.publishDate} />
						<Typography
							variant="caption"
							color="text.secondary"
							aria-live="polite"
							noWrap
							sx={{ display: { xs: "none", md: "block" } }}
						>
							{statusText}
						</Typography>
					</Stack>
					{saved?.postUrl && (
						<Tooltip title={isLive ? "View live" : "Open preview"}>
							<IconButton component="a" href={saved.postUrl} target="_blank" rel="noopener" aria-label={isLive ? "View live" : "Open preview"}>
								<OpenInNew />
							</IconButton>
						</Tooltip>
					)}
					{saved && (
						<Tooltip title="History">
							<IconButton aria-label="History" onClick={() => setHistoryOpen(true)}>
								<HistoryOutlined />
							</IconButton>
						</Tooltip>
					)}
					<Tooltip title={settingsOpen ? "Hide post settings" : "Post settings"}>
						<IconButton aria-label="Post settings" aria-pressed={settingsOpen} color={settingsOpen ? "primary" : "default"} onClick={toggleSettings}>
							<TuneOutlined />
						</IconButton>
					</Tooltip>
					<Button type="submit" variant="contained" startIcon={<SaveOutlined />} loading={save.isPending} sx={{ ml: 0.5 }}>
						{saved ? "Save" : "Create post"}
					</Button>
				</Paper>

				<Box
					sx={{
						display: "grid",
						gap: 3,
						p: { xs: 1.5, sm: 3 },
						gridTemplateColumns: wide && settingsOpen ? "minmax(0, 1fr) 340px" : "minmax(0, 1fr)",
						alignItems: "start",
					}}
				>
					<Stack spacing={2} sx={{ minWidth: 0, width: "100%", maxWidth: 860, mx: "auto" }}>
						{flash?.kind === "error" && (
							<Alert severity="error" onClose={() => setFlash(null)}>
								{flash.text}
							</Alert>
						)}
						{local.pending && (
							<Alert
								severity="info"
								action={
									<>
										<Button
											color="inherit"
											size="small"
											onClick={() => {
												const data = local.pending!.data;
												setDraft({ ...synced, ...data, tags: Array.isArray(data.tags) ? data.tags : synced.tags });
												setSlugLocked(true);
												local.dismissPending();
											}}
										>
											Restore it
										</Button>
										<Button color="inherit" size="small" onClick={local.discardPending}>
											Discard
										</Button>
									</>
								}
							>
								An unsaved draft from {new Date(local.pending.savedAt).toLocaleString()} differs from what's shown here.
							</Alert>
						)}

						<Paper sx={{ overflow: "visible" }}>
							<CoverBanner
								url={draft.coverImage}
								status={coverStatus}
								onUpload={() => coverFile.current?.click()}
								onChoose={() => openPicker("cover")}
								onRemove={() => update({ coverImage: "" })}
							/>
							<input
								ref={coverFile}
								type="file"
								accept="image/jpeg,image/png,image/webp,image/gif"
								hidden
								onChange={(e) => chooseCover(e.target.files?.[0])}
							/>

							<Box sx={{ px: sidePadding, pt: 3.5, pb: 2 }}>
								<InputBase
									fullWidth
									multiline
									value={draft.title}
									placeholder="Title"
									inputProps={{ "aria-label": "Title", maxLength: 200 }}
									sx={{ fontSize: { xs: "1.75rem", sm: "2.25rem" }, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2, p: 0 }}
									onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
									onChange={(e) => {
										const title = e.target.value.replace(/\n/g, " ");
										update(slugLocked ? { title } : { title, slug: slugify(title) });
									}}
								/>
								<InputBase
									fullWidth
									multiline
									value={draft.description}
									placeholder="Add a short summary for post cards, feeds and search results…"
									inputProps={{ "aria-label": "Summary", maxLength: 500 }}
									sx={{ mt: 1.5, fontSize: "1.0625rem", color: "text.secondary", lineHeight: 1.5, p: 0 }}
									onChange={(e) => update({ description: e.target.value })}
								/>
								{draft.description.length > 400 && (
									<Typography variant="caption" color="text.secondary">
										{draft.description.length} / 500
									</Typography>
								)}
							</Box>

							<Box
								sx={{
									position: "sticky",
									top: `calc(${HEADER_HEIGHT} + ${barHeight}px)`,
									zIndex: 10,
									bgcolor: "background.paper",
									borderTop: 1,
									borderBottom: 1,
									borderColor: "divider",
									px: { xs: 1, sm: 3 },
									py: 0.75,
									display: "flex",
									alignItems: "center",
									gap: 1,
									flexWrap: "wrap",
								}}
							>
								<Box sx={{ flex: 1, minWidth: 0 }}>
									{mode === "visual" && editor ? (
										<FormatToolbar editor={editor} onInsertImage={() => openPicker("insert")} />
									) : mode === "markdown" ? (
										<MarkdownToolbar editor={markdownEditor} onInsertImage={() => openPicker("insert")} />
									) : (
										<Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
											How the post will look, rendered by the site.
										</Typography>
									)}
								</Box>
								<ToggleButtonGroup
									size="small"
									exclusive
									value={mode}
									onChange={(_event, next: Mode | null) => next && changeMode(next)}
									aria-label="Editor"
								>
									<ToggleButton value="visual" sx={{ px: 1, py: 0.25, textTransform: "none", fontSize: "0.8125rem" }}>
										Visual
									</ToggleButton>
									<ToggleButton value="markdown" sx={{ px: 1, py: 0.25, textTransform: "none", fontSize: "0.8125rem" }}>
										Markdown
									</ToggleButton>
									<ToggleButton value="preview" sx={{ px: 1, py: 0.25, textTransform: "none", fontSize: "0.8125rem" }}>
										Preview
									</ToggleButton>
								</ToggleButtonGroup>
							</Box>

							{lossy && mode !== "preview" && (
								<Alert severity={mode === "visual" ? "warning" : "info"} square sx={{ borderBottom: 1, borderColor: "divider" }}>
									{mode === "visual"
										? "This post has Markdown the visual editor can't reproduce exactly, such as raw HTML or blank <br> lines. Editing it here rewrites those parts; check Preview before saving."
										: "This post has Markdown the visual editor can't reproduce exactly, such as raw HTML or blank <br> lines, so it opened as Markdown."}
								</Alert>
							)}

							<Box sx={{ px: sidePadding, py: 3, minHeight: 420 }}>
								<Box hidden={mode !== "visual"}>{editor && <PostEditorContent editor={editor} />}</Box>
								{mode === "markdown" && (
									<MarkdownEditor
										ref={markdownEditor}
										value={draft.body}
										placeholder="Write your post in Markdown…"
										onChange={(body) => update({ body })}
										onImageFiles={async (files) => {
											for (const file of files) {
												const url = await uploadBodyImage(file).catch(() => "");
												const named = withUniquePastedName(file);
												if (url) markdownEditor.current?.insertAtCursor(`![${named.name.replace(/\.[^.]+$/, "")}](${url})\n`);
											}
										}}
									/>
								)}
								{mode === "preview" &&
									(preview.isError ? (
										<Alert severity="error">{errorMessage(preview.error, "Preview failed to load.")}</Alert>
									) : preview.data ? (
										<div className="c-post__body" dangerouslySetInnerHTML={{ __html: preview.data }} />
									) : (
										<Typography color="text.secondary">{preview.isFetching ? "Loading preview…" : "Nothing to preview yet."}</Typography>
									))}
							</Box>

							<Stack
								direction="row"
								spacing={2}
								useFlexGap
								sx={{ flexWrap: "wrap", px: sidePadding, py: 1.5, borderTop: 1, borderColor: "divider", color: "text.secondary" }}
							>
								<Typography variant="caption">{words.toLocaleString()} words</Typography>
								<Typography variant="caption">{readingMinutes} min read</Typography>
								<Typography variant="caption" sx={{ ml: { sm: "auto" } }}>
									Paste or drop images to upload them to {uploadPath()}
								</Typography>
							</Stack>
						</Paper>
					</Stack>

					{wide && settingsOpen && (
						<Box sx={{ position: "sticky", top: `calc(${HEADER_HEIGHT} + ${barHeight}px + 24px)`, minWidth: 0 }}>{settings}</Box>
					)}
				</Box>
			</Box>

			{!wide && (
				<Drawer anchor="right" open={settingsOpen} onClose={toggleSettings} slotProps={{ paper: { sx: { width: 360, maxWidth: "100vw" } } }}>
					{settings}
				</Drawer>
			)}

			{/* Success shows in a corner, not above the editor, so saving doesn't move the page. */}
			<Snackbar
				open={flash?.kind === "success"}
				autoHideDuration={3000}
				onClose={(_event, reason) => reason !== "clickaway" && setFlash(null)}
				anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
			>
				<Alert severity="success" variant="filled" onClose={() => setFlash(null)} sx={{ boxShadow: 3 }}>
					{toastText}
				</Alert>
			</Snackbar>

			<ImagePicker
				open={pickerOpen}
				title={picker === "insert" ? "Insert an image" : "Choose a cover image"}
				onPick={pickImage}
				onClose={() => setPickerOpen(false)}
			/>

			{saved && <HistoryDrawer postId={saved.id} open={historyOpen} onRestore={restoreRevision} onClose={() => setHistoryOpen(false)} />}

			{croppingCover && (
				<ImageCropper
					file={croppingCover}
					initialShape="cover"
					confirmLabel="Upload cover"
					onClose={() => setCroppingCover(null)}
					onDone={(cropped) => {
						setCroppingCover(null);
						uploadCover(cropped);
					}}
				/>
			)}

			<ConfirmDialog
				open={confirmingDelete}
				title="Delete this post?"
				confirmLabel="Delete permanently"
				busy={remove.isPending}
				onClose={() => setConfirmingDelete(false)}
				onConfirm={() => saved && remove.mutate(saved.id)}
			>
				"{saved?.title}" will be permanently deleted, along with its comments and view counts. This can't be undone.
			</ConfirmDialog>
		</Page>
	);
}

function CoverBanner({
	url,
	status,
	onUpload,
	onChoose,
	onRemove,
}: {
	url: string;
	status: { text: string; error: boolean } | null;
	onUpload: () => void;
	onChoose: () => void;
	onRemove: () => void;
}) {
	const actions = (
		<>
			<Button size="small" variant={url ? "contained" : "text"} color={url ? "inherit" : "primary"} startIcon={<UploadOutlined />} onClick={onUpload}>
				{url ? "Replace" : "Upload a cover"}
			</Button>
			<Button size="small" variant={url ? "contained" : "text"} color={url ? "inherit" : "primary"} startIcon={<PhotoLibraryOutlined />} onClick={onChoose}>
				{url ? "Library" : "Choose from library"}
			</Button>
			{url && (
				<Button size="small" variant="contained" color="inherit" startIcon={<Close />} onClick={onRemove}>
					Remove
				</Button>
			)}
		</>
	);

	if (!url) {
		return (
			<Stack
				direction="row"
				spacing={1}
				useFlexGap
				sx={{
					alignItems: "center",
					flexWrap: "wrap",
					px: { xs: 2, sm: 4.5 },
					pt: 2,
					color: "text.secondary",
				}}
			>
				<ImageOutlined fontSize="small" />
				{actions}
				{status && (
					<Typography variant="caption" color={status.error ? "error" : "text.secondary"}>
						{status.text}
					</Typography>
				)}
			</Stack>
		);
	}

	return (
		<Box
			sx={{
				position: "relative",
				aspectRatio: "21 / 9",
				maxHeight: 360,
				width: "100%",
				borderTopLeftRadius: "inherit",
				borderTopRightRadius: "inherit",
				overflow: "hidden",
				bgcolor: "background.raised",
				backgroundImage: `url("${url.replace(/"/g, "%22")}")`,
				backgroundSize: "cover",
				backgroundPosition: "center",
				"& .c-cover-actions": { opacity: { md: 0 }, transition: "opacity 120ms ease" },
				"&:hover .c-cover-actions, &:focus-within .c-cover-actions": { opacity: 1 },
			}}
			role="img"
			aria-label="Cover image"
		>
			<Stack
				className="c-cover-actions"
				direction="row"
				spacing={1}
				sx={{ position: "absolute", right: 12, bottom: 12, "& .MuiButton-root": { bgcolor: "rgba(255,255,255,0.92)", color: "#111" } }}
			>
				{actions}
			</Stack>
			{status && (
				<Typography
					variant="caption"
					sx={{ position: "absolute", left: 12, bottom: 12, px: 1, py: 0.25, borderRadius: 1, bgcolor: "rgba(0,0,0,0.6)", color: status.error ? "#fca5a5" : "#fff" }}
				>
					{status.text}
				</Typography>
			)}
		</Box>
	);
}

function MarkdownToolbar({ editor, onInsertImage }: { editor: React.RefObject<MarkdownEditorHandle | null>; onInsertImage: () => void }) {
	const tool = (title: string, run: () => void, icon: ReactNode) => (
		<Tooltip title={title}>
			<IconButton size="small" aria-label={title} onClick={run} sx={{ borderRadius: 1.5 }}>
				{icon}
			</IconButton>
		</Tooltip>
	);
	const sep = <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />;
	return (
		<Stack direction="row" spacing={0.25} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }} role="toolbar" aria-label="Markdown">
			{tool("Heading", () => editor.current?.prefixLines("## "), <Title fontSize="small" />)}
			{sep}
			{tool("Bold (Ctrl/Cmd+B)", () => editor.current?.wrapSelection("**"), <FormatBold fontSize="small" />)}
			{tool("Italic (Ctrl/Cmd+I)", () => editor.current?.wrapSelection("_"), <FormatItalic fontSize="small" />)}
			{tool("Code", () => editor.current?.wrapSelection("`"), <Code fontSize="small" />)}
			{tool("Link (Ctrl/Cmd+K)", () => editor.current?.wrapSelection("[", "](https://)"), <InsertLink fontSize="small" />)}
			{sep}
			{tool("Bulleted list", () => editor.current?.prefixLines("- "), <FormatListBulleted fontSize="small" />)}
			{tool("Numbered list", () => editor.current?.prefixLines("", true), <FormatListNumbered fontSize="small" />)}
			{tool("Quote", () => editor.current?.prefixLines("> "), <FormatQuote fontSize="small" />)}
			{sep}
			{tool("Image", onInsertImage, <ImageOutlined fontSize="small" />)}
		</Stack>
	);
}

function SettingsPanel({
	draft,
	saved,
	tags,
	slugLocked,
	deleting,
	onUpdate,
	onSlug,
	onDelete,
	onClose,
}: {
	draft: Draft;
	saved: Post | null;
	tags: string[];
	slugLocked: boolean;
	deleting: boolean;
	onUpdate: (patch: Partial<Draft>) => void;
	onSlug: (slug: string) => void;
	onDelete: () => void;
	onClose?: () => void;
}) {
	return (
		<Paper sx={{ border: onClose ? 0 : undefined, borderRadius: onClose ? 0 : undefined, minHeight: onClose ? "100%" : undefined }}>
			<Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", px: 2.5, pt: 2, pb: 1 }}>
				<Typography variant="h3" component="h2">
					Post settings
				</Typography>
				{onClose && (
					<IconButton aria-label="Close settings" size="small" onClick={onClose}>
						<Close />
					</IconButton>
				)}
			</Stack>

			<Section title="Publishing">
				<TextField select size="small" label="Status" value={draft.status} onChange={(e) => onUpdate({ status: e.target.value })}>
					<MenuItem value="draft">Draft</MenuItem>
					<MenuItem value="published">Published</MenuItem>
					<MenuItem value="archived">Archived</MenuItem>
				</TextField>
				<TextField
					type="datetime-local"
					size="small"
					label="Publish date"
					value={draft.publishDate}
					helperText={`${localZoneLabel()}. A future date on a published post schedules it.`}
					slotProps={{ inputLabel: { shrink: true } }}
					onChange={(e) => onUpdate({ publishDate: e.target.value })}
				/>
				<FormControlLabel
					control={<Switch checked={draft.featured} onChange={(e) => onUpdate({ featured: e.target.checked })} />}
					label="Feature this post"
				/>
				{saved?.authorName && (
					<Typography variant="body2" color="text.secondary">
						By <strong>{saved.authorName}</strong>
					</Typography>
				)}
			</Section>

			<Section title="Address">
				<TextField
					size="small"
					value={draft.slug}
					placeholder="from-the-title"
					helperText={slugLocked ? "Leave blank to build it from the title." : "Follows the title until you edit it."}
					slotProps={{
						htmlInput: { "aria-label": "Slug", style: { fontFamily: "var(--font-mono)", fontSize: "0.8125rem" } },
						input: { startAdornment: <InputAdornment position="start">/posts/</InputAdornment> },
					}}
					onChange={(e) => onSlug(e.target.value)}
				/>
			</Section>

			<Section title="Tags">
				<Autocomplete
					multiple
					freeSolo
					autoSelect
					size="small"
					options={tags}
					value={draft.tags}
					onChange={(_event, next) => onUpdate({ tags: next.map((tag) => tag.trim()).filter(Boolean) })}
					renderValue={(value, getItemProps) =>
						value.map((tag, index) => {
							const { key, ...itemProps } = getItemProps({ index });
							return <Chip key={key} label={tag} size="small" {...itemProps} />;
						})
					}
					renderInput={(params) => <TextField {...params} placeholder="Add a tag" helperText="Press Enter to add a new one." />}
				/>
			</Section>

			<Section title="Cover image address">
				<TextField
					size="small"
					type="url"
					value={draft.coverImage}
					placeholder="https://…"
					helperText="Set by uploading or choosing a cover above, or paste an address."
					slotProps={{ htmlInput: { "aria-label": "Cover image URL" } }}
					onChange={(e) => onUpdate({ coverImage: e.target.value })}
				/>
			</Section>

			{saved && canDelete(saved) && (
				<Section title="Delete">
					<Button color="error" variant="outlined" startIcon={<DeleteOutline />} disabled={deleting} onClick={onDelete} sx={{ alignSelf: "flex-start" }}>
						Delete post
					</Button>
				</Section>
			)}
		</Paper>
	);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<Box sx={{ px: 2.5, py: 2, borderTop: 1, borderColor: "divider", "&:first-of-type": { borderTop: 0 } }}>
			<Typography variant="overline" color="text.secondary" sx={{ display: "block", lineHeight: 1.6, mb: 1.25 }}>
				{title}
			</Typography>
			<Stack spacing={2}>{children}</Stack>
		</Box>
	);
}

export function NewPostPage() {
	return <PostEditor key="new" post={null} />;
}

const editRoute = getRouteApi("/posts/$postId/edit");

export function EditPostPage() {
	const { postId } = editRoute.useParams();
	const post = useQuery({ queryKey: ["post", postId], queryFn: () => postsApi.get(postId) });

	if (post.isPending) {
		return (
			<Page>
				<Skeleton variant="rounded" height={480} />
			</Page>
		);
	}

	if (post.isError) {
		return (
			<Page>
				<Alert severity="error" sx={{ mb: 2 }}>
					{errorMessage(post.error, "Couldn't load this post.")}
				</Alert>
				<ButtonLink to="/posts" startIcon={<ArrowBack />}>
					Back to posts
				</ButtonLink>
			</Page>
		);
	}

	return <PostEditor key={post.data.id} post={post.data} />;
}
