import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useBlocker, useNavigate } from "@tanstack/react-router";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import InputBase from "@mui/material/InputBase";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ArrowBack from "@mui/icons-material/ArrowBack";
import Code from "@mui/icons-material/Code";
import DeleteOutline from "@mui/icons-material/DeleteOutlined";
import FormatBold from "@mui/icons-material/FormatBold";
import FormatItalic from "@mui/icons-material/FormatItalic";
import FormatListBulleted from "@mui/icons-material/FormatListBulleted";
import FormatListNumbered from "@mui/icons-material/FormatListNumbered";
import FormatQuote from "@mui/icons-material/FormatQuote";
import Fullscreen from "@mui/icons-material/Fullscreen";
import FullscreenExit from "@mui/icons-material/FullscreenExit";
import HistoryOutlined from "@mui/icons-material/HistoryOutlined";
import ImageOutlined from "@mui/icons-material/ImageOutlined";
import InsertLink from "@mui/icons-material/InsertLink";
import OpenInNew from "@mui/icons-material/OpenInNew";
import PhotoLibraryOutlined from "@mui/icons-material/PhotoLibraryOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import Title from "@mui/icons-material/Title";
import UploadOutlined from "@mui/icons-material/UploadOutlined";
import { errorMessage } from "../../app/api";
import { ConfirmDialog } from "../../shared/ConfirmDialog";
import { ImageCropper } from "../../shared/ImageCropper";
import { ImagePicker, defaultUploadPath } from "../../shared/ImagePicker";
import { Page } from "../../shared/Page";
import { StatusBadge } from "../../shared/StatusBadge";
import { ButtonLink, IconButtonLink } from "../../shared/links";
import { uploadImage } from "../../shared/media";
import { HistoryDrawer } from "./HistoryDrawer";
import { MarkdownEditor, type MarkdownEditorHandle } from "./MarkdownEditor";
import { headingOffsetsIn, linkScroll } from "./scrollSync";
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

type Mode = "write" | "split" | "preview";

const MODES: { id: Mode; label: string }[] = [
	{ id: "write", label: "Write" },
	{ id: "split", label: "Split" },
	{ id: "preview", label: "Preview" },
];

const HEADER_HEIGHT = "var(--site-padding-top, 64px)";
const MODE_KEY = "kisdigital:manage:editor-mode";
const FOCUS_KEY = "kisdigital:distraction-free";

function toDraft(post: Post | null): Draft {
	return {
		title: post?.title ?? "",
		slug: post?.slug ?? "",
		description: post?.description ?? "",
		body: post?.body ?? "",
		status: post?.status ?? "draft",
		publishDate: post?.publishDate ?? "",
		featured: post?.featured ?? false,
		coverImage: post?.coverImage ?? "",
		tags: post?.tags ?? [],
	};
}

function toInput(draft: Draft): PostInput {
	return draft;
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

function PostEditor({ post }: { post: Post | null }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const editor = useRef<MarkdownEditorHandle>(null);
	const coverFile = useRef<HTMLInputElement>(null);
	const leaving = useRef(false);

	const [saved, setSaved] = useState(post);
	const [synced, setSynced] = useState(() => toDraft(post));
	const [draft, setDraft] = useState(synced);
	const [slugLocked, setSlugLocked] = useState(synced.slug.length > 0);
	const [flash, setFlash] = useState<{ kind: "success" | "error"; text: string } | null>(null);
	const [mode, setMode] = useState<Mode>(() => {
		const stored = readStored(MODE_KEY);
		return stored === "split" || stored === "preview" ? stored : "write";
	});
	const [focusMode, setFocusMode] = useState(() => readStored(FOCUS_KEY) === "1");
	const [picker, setPicker] = useState<"cover" | "insert" | null>(null);
	const [pickerOpen, setPickerOpen] = useState(false);
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const [croppingCover, setCroppingCover] = useState<File | null>(null);
	const [historyOpen, setHistoryOpen] = useState(false);
	const [serverSavedAt, setServerSavedAt] = useState<number | null>(null);
	const [uploadStatus, setUploadStatus] = useState("");
	const [coverStatus, setCoverStatus] = useState<{ text: string; error: boolean } | null>(null);

	const local = useLocalDraft(`kisdigital:manage:post-draft:${post?.id ?? "new"}`, draft, synced);
	const allTags = useQuery({ queryKey: ["tags"], queryFn: postsApi.tags });

	const previewBody = useDebounced(draft.body, 500);
	const preview = useQuery({
		queryKey: ["preview", previewBody],
		queryFn: () => postsApi.preview(previewBody),
		enabled: mode !== "write",
		placeholderData: keepPreviousData,
		staleTime: Infinity,
		gcTime: 60_000,
	});

	// Side by side, scrolling either pane brings the other to the same place.
	const [previewPane, setPreviewPane] = useState<HTMLDivElement | null>(null);
	const scrollLink = useRef<ReturnType<typeof linkScroll> | null>(null);
	useEffect(() => {
		const scroller = editor.current?.scroller();
		if (mode !== "split" || !previewPane || !scroller) return;
		const unlink = linkScroll(
			{ el: scroller, headings: () => editor.current?.headingOffsets() ?? [] },
			{ el: previewPane, headings: () => headingOffsetsIn(previewPane) },
		);
		scrollLink.current = unlink;
		return () => {
			unlink();
			scrollLink.current = null;
		};
	}, [mode, previewPane]);
	// A fresh preview can be a different height, which moves everything in it.
	useEffect(() => {
		scrollLink.current?.sync();
	}, [preview.data]);

	function update(patch: Partial<Draft>) {
		setDraft((current) => ({ ...current, ...patch }));
	}

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
			setSynced({ ...submitted, slug: result.slug, publishDate: result.publishDate });
			setDraft((current) => ({
				...current,
				slug: current.slug === submitted.slug ? result.slug : current.slug,
				publishDate: current.publishDate === submitted.publishDate ? result.publishDate : current.publishDate,
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
		setMode(next);
		writeStored(MODE_KEY, next);
	}

	function toggleFocusMode() {
		setFocusMode((on) => {
			writeStored(FOCUS_KEY, on ? "0" : "1");
			return !on;
		});
	}

	async function insertImages(files: File[]) {
		for (const file of files) {
			setUploadStatus("Uploading image…");
			try {
				const named = withUniquePastedName(file);
				const url = await uploadImage(named, defaultUploadPath);
				editor.current?.insertAtCursor(`![${named.name.replace(/\.[^.]+$/, "")}](${url})\n`);
			} catch (err) {
				setFlash({ kind: "error", text: errorMessage(err, "Image upload failed.") });
			}
		}
		setUploadStatus("");
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
		setCoverStatus({ text: "Uploading…", error: false });
		try {
			update({ coverImage: await uploadImage(file, defaultUploadPath) });
			setCoverStatus({ text: "Uploaded.", error: false });
		} catch (err) {
			setCoverStatus({ text: errorMessage(err, "Upload failed. Check your connection and try again."), error: true });
		} finally {
			if (coverFile.current) coverFile.current.value = "";
		}
	}

	function pickImage(url: string, filename: string, alt: string) {
		if (picker === "insert") {
			editor.current?.insertAtCursor(`![${alt || filename.replace(/\.[^.]+$/, "")}](${url})`);
		} else {
			update({ coverImage: url });
			setCoverStatus({ text: "Selected.", error: false });
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
	else if (uploadStatus) statusText = uploadStatus;
	else if (local.dirty)
		statusText = serverSavedAt
			? "Unsaved changes, backed up to the server"
			: local.savedAt
				? "Unsaved changes, kept on this device"
				: "Unsaved changes";
	else if (saved) statusText = "All changes saved";

	const sideBySide = !focusMode;

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
					square
					component="header"
					sx={{
						position: "sticky",
						top: HEADER_HEIGHT,
						zIndex: 10,
						border: 0,
						borderBottom: 1,
						borderColor: "divider",
						px: { xs: 2, sm: 3 },
						py: 1.5,
						display: "flex",
						alignItems: "center",
						gap: 2,
						flexWrap: "wrap",
					}}
				>
					<Tooltip title="Back to posts">
						<IconButtonLink to="/posts" aria-label="Back to posts">
							<ArrowBack />
						</IconButtonLink>
					</Tooltip>
					<Box sx={{ flex: 1, minWidth: 0 }}>
						<Typography variant="overline" color="text.secondary" sx={{ display: "block", lineHeight: 1.4 }}>
							{saved ? "Editing post" : "New post"}
						</Typography>
						<Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
							<StatusBadge
								status={saved?.status ?? "draft"}
								isScheduled={saved?.isScheduled}
								publishDate={saved?.publishDate}
							/>
							{saved && saved.postUrl && (
								<Button
									href={saved.postUrl}
									target="_blank"
									rel="noopener"
									size="small"
									endIcon={<OpenInNew sx={{ fontSize: "0.875rem !important" }} />}
								>
									{isLive ? "View live" : "Preview"}
								</Button>
							)}
						</Stack>
					</Box>
					<Typography variant="caption" color="text.secondary" aria-live="polite" noWrap>
						{statusText}
					</Typography>
					{saved && (
						<Tooltip title="History">
							<IconButton aria-label="History" onClick={() => setHistoryOpen(true)}>
								<HistoryOutlined />
							</IconButton>
						</Tooltip>
					)}
					<Tooltip title="Distraction-free mode">
						<IconButton aria-pressed={focusMode} color={focusMode ? "primary" : "default"} onClick={toggleFocusMode}>
							{focusMode ? <FullscreenExit /> : <Fullscreen />}
						</IconButton>
					</Tooltip>
					{saved && canDelete(saved) && (
						<Button
							color="error"
							startIcon={<DeleteOutline />}
							disabled={remove.isPending || save.isPending}
							onClick={() => setConfirmingDelete(true)}
						>
							Delete
						</Button>
					)}
					<ButtonLink to="/posts" color="inherit">
						Cancel
					</ButtonLink>
					<Button type="submit" variant="contained" startIcon={<SaveOutlined />} loading={save.isPending}>
						{saved ? "Save changes" : "Create post"}
					</Button>
				</Paper>

				<Stack spacing={2} sx={{ px: { xs: 2, sm: 3 }, pt: flash || local.pending ? 2 : 0 }}>
					{flash && (
						<Alert severity={flash.kind} onClose={() => setFlash(null)}>
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
				</Stack>

				<Box
					sx={{
						display: "grid",
						gap: 3,
						p: { xs: 2, sm: 3 },
						gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: sideBySide ? "minmax(0, 1fr) 340px" : "minmax(0, 1fr)" },
						maxWidth: sideBySide ? "none" : 1200,
						mx: "auto",
					}}
				>
					<Stack spacing={3} sx={{ minWidth: 0 }}>
						<Paper sx={{ p: 2.5 }}>
							<InputBase
								fullWidth
								value={draft.title}
								placeholder="Your post title…"
								inputProps={{ "aria-label": "Title" }}
								sx={{ fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.01em" }}
								onChange={(e) =>
									update(slugLocked ? { title: e.target.value } : { title: e.target.value, slug: slugify(e.target.value) })
								}
							/>
							{sideBySide && (
								<TextField
									value={draft.slug}
									placeholder="auto-generated-from-title"
									helperText="Leave blank to auto-generate from the title."
									sx={{ mt: 1.5 }}
									slotProps={{
										htmlInput: { "aria-label": "Slug", style: { fontFamily: "var(--font-mono)", fontSize: "0.875rem" } },
										input: { startAdornment: <InputAdornment position="start">/posts/</InputAdornment> },
									}}
									onChange={(e) => {
										setSlugLocked(true);
										update({ slug: e.target.value });
									}}
								/>
							)}
						</Paper>

						{sideBySide && (
							<Panel title="Description">
								<TextField
									multiline
									minRows={3}
									value={draft.description}
									placeholder="Short summary shown in post cards…"
									helperText={`${draft.description.length} / 500 characters`}
									slotProps={{ htmlInput: { maxLength: 500, "aria-label": "Description" } }}
									onChange={(e) => update({ description: e.target.value })}
								/>
							</Panel>
						)}

						<Panel
							title="Body"
							hint="Markdown"
							action={
								<ToggleButtonGroup
									size="small"
									exclusive
									value={mode}
									onChange={(_event, next: Mode | null) => next && changeMode(next)}
									aria-label="Editor layout"
								>
									{MODES.map((item) => (
										<ToggleButton key={item.id} value={item.id} sx={{ px: 1.5, py: 0.25, textTransform: "none" }}>
											{item.label}
										</ToggleButton>
									))}
								</ToggleButtonGroup>
							}
						>
							{mode !== "preview" && (
								<Stack
									direction="row"
									spacing={0.25}
									sx={{ alignItems: "center", bgcolor: "background.raised", borderRadius: 2, p: 0.5, mb: 1.5 }}
								>
									<ToolButton title="Bold (Ctrl/Cmd+B)" onClick={() => editor.current?.wrapSelection("**")}>
										<FormatBold fontSize="small" />
									</ToolButton>
									<ToolButton title="Italic (Ctrl/Cmd+I)" onClick={() => editor.current?.wrapSelection("_")}>
										<FormatItalic fontSize="small" />
									</ToolButton>
									<ToolButton title="Link (Ctrl/Cmd+K)" onClick={() => editor.current?.wrapSelection("[", "](https://)")}>
										<InsertLink fontSize="small" />
									</ToolButton>
									<Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
									<ToolButton title="Heading" onClick={() => editor.current?.prefixLines("## ")}>
										<Title fontSize="small" />
									</ToolButton>
									<ToolButton title="Code" onClick={() => editor.current?.wrapSelection("`")}>
										<Code fontSize="small" />
									</ToolButton>
									<ToolButton title="Quote" onClick={() => editor.current?.prefixLines("> ")}>
										<FormatQuote fontSize="small" />
									</ToolButton>
									<Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
									<ToolButton title="Bulleted list" onClick={() => editor.current?.prefixLines("- ")}>
										<FormatListBulleted fontSize="small" />
									</ToolButton>
									<ToolButton title="Numbered list" onClick={() => editor.current?.prefixLines("", true)}>
										<FormatListNumbered fontSize="small" />
									</ToolButton>
									<Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
									<ToolButton title="Insert image" onClick={() => openPicker("insert")}>
										<ImageOutlined fontSize="small" />
									</ToolButton>
								</Stack>
							)}

							<div className={`c-post-editor__panes c-post-editor__panes--${mode}${focusMode ? " is-focus" : ""}`}>
								<div className="c-post-editor__pane" hidden={mode === "preview"}>
									<MarkdownEditor
										ref={editor}
										value={draft.body}
										placeholder="Write your post in Markdown…"
										onChange={(body) => update({ body })}
										onImageFiles={insertImages}
									/>
								</div>
								{mode !== "write" && (
									<div ref={setPreviewPane} className="c-post-editor__preview c-post__body">
										{preview.isError ? (
											<Alert severity="error">{errorMessage(preview.error, "Preview failed to load.")}</Alert>
										) : preview.data ? (
											<div dangerouslySetInnerHTML={{ __html: preview.data }} />
										) : (
											<Typography color="text.secondary">
												{preview.isFetching ? "Loading preview…" : "Nothing to preview yet."}
											</Typography>
										)}
									</div>
								)}
							</div>

							<Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap", mt: 1.5, color: "text.secondary" }}>
								<Typography variant="caption">{words.toLocaleString()} words</Typography>
								<Typography variant="caption">{readingMinutes} min read</Typography>
								<Typography variant="caption">Paste or drop an image to upload it</Typography>
							</Stack>
						</Panel>
					</Stack>

					{sideBySide && (
						<Stack spacing={3} sx={{ minWidth: 0 }}>
							<Panel title="Publish">
								<Stack spacing={2}>
									<TextField select label="Status" value={draft.status} onChange={(e) => update({ status: e.target.value })}>
										<MenuItem value="draft">Draft</MenuItem>
										<MenuItem value="published">Published</MenuItem>
										<MenuItem value="archived">Archived</MenuItem>
									</TextField>
									<TextField
										type="datetime-local"
										label="Publish date"
										value={draft.publishDate}
										helperText="A future date with Published status schedules the post. It stays hidden from visitors, RSS and the sitemap until then."
										slotProps={{ inputLabel: { shrink: true } }}
										onChange={(e) => update({ publishDate: e.target.value })}
									/>
									<FormControlLabel
										control={<Switch checked={draft.featured} onChange={(e) => update({ featured: e.target.checked })} />}
										label="Feature this post"
									/>
									{saved?.authorName && (
										<Typography variant="body2" color="text.secondary">
											Author: <strong>{saved.authorName}</strong>
										</Typography>
									)}
								</Stack>
							</Panel>

							<Panel title="Cover image">
								<Stack spacing={1.5}>
									{draft.coverImage && (
										<Box
											component="img"
											src={draft.coverImage}
											alt="Cover preview"
											sx={{ width: "100%", borderRadius: 2, border: 1, borderColor: "divider", display: "block" }}
										/>
									)}
									<TextField
										type="url"
										value={draft.coverImage}
										placeholder="https://…"
										helperText="Paste a full image URL, or upload one below."
										slotProps={{ htmlInput: { "aria-label": "Cover image URL" } }}
										onChange={(e) => update({ coverImage: e.target.value })}
									/>
									<input
										ref={coverFile}
										type="file"
										accept="image/jpeg,image/png,image/webp,image/gif"
										hidden
										onChange={(e) => chooseCover(e.target.files?.[0])}
									/>
									<Stack direction="row" spacing={1}>
										<Button variant="outlined" size="small" startIcon={<UploadOutlined />} onClick={() => coverFile.current?.click()}>
											Upload
										</Button>
										<Button variant="outlined" size="small" startIcon={<PhotoLibraryOutlined />} onClick={() => openPicker("cover")}>
											Choose existing
										</Button>
									</Stack>
									{coverStatus && (
										<Typography variant="caption" color={coverStatus.error ? "error" : "text.secondary"}>
											{coverStatus.text}
										</Typography>
									)}
								</Stack>
							</Panel>

							<Panel title="Tags">
								<Autocomplete
									multiple
									freeSolo
									autoSelect
									size="small"
									options={allTags.data ?? []}
									value={draft.tags}
									onChange={(_event, next) => update({ tags: next.map((tag) => tag.trim()).filter(Boolean) })}
									renderValue={(value, getItemProps) =>
										value.map((tag, index) => {
											const { key, ...itemProps } = getItemProps({ index });
											return <Chip key={key} label={tag} size="small" {...itemProps} />;
										})
									}
									renderInput={(params) => (
										<TextField {...params} placeholder="Add a tag" helperText="Pick an existing tag or type a new one and press Enter." />
									)}
								/>
							</Panel>
						</Stack>
					)}
				</Box>
			</Box>

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

function Panel({ title, hint, action, children }: { title: string; hint?: string; action?: ReactNode; children: ReactNode }) {
	return (
		<Paper sx={{ p: 2.5 }}>
			<Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 2 }}>
				<Stack direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
					<Typography variant="h3" component="h2">
						{title}
					</Typography>
					{hint && (
						<Typography variant="caption" color="text.secondary">
							{hint}
						</Typography>
					)}
				</Stack>
				{action}
			</Stack>
			{children}
		</Paper>
	);
}

function ToolButton({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) {
	return (
		<Tooltip title={title}>
			<IconButton size="small" aria-label={title} onClick={onClick} sx={{ borderRadius: 1.5 }}>
				{children}
			</IconButton>
		</Tooltip>
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
