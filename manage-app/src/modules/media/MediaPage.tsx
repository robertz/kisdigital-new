import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import ChevronLeft from "@mui/icons-material/ChevronLeft";
import ChevronRight from "@mui/icons-material/ChevronRight";
import Close from "@mui/icons-material/Close";
import ContentCopy from "@mui/icons-material/ContentCopy";
import CreateNewFolderOutlined from "@mui/icons-material/CreateNewFolderOutlined";
import Crop from "@mui/icons-material/Crop";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import DriveFileMoveOutlined from "@mui/icons-material/DriveFileMoveOutlined";
import DriveFileRenameOutline from "@mui/icons-material/DriveFileRenameOutline";
import ErrorOutlined from "@mui/icons-material/ErrorOutlined";
import Folder from "@mui/icons-material/Folder";
import GridViewOutlined from "@mui/icons-material/GridViewOutlined";
import InsertDriveFileOutlined from "@mui/icons-material/InsertDriveFileOutlined";
import OpenInNew from "@mui/icons-material/OpenInNew";
import UploadOutlined from "@mui/icons-material/UploadOutlined";
import ViewListOutlined from "@mui/icons-material/ViewListOutlined";
import { errorMessage } from "../../app/api";
import { AdminOnly } from "../../shared/AdminOnly";
import { ImageCropper } from "../../shared/ImageCropper";
import { MediaBreadcrumbs, mediaQueryKey } from "../../shared/MediaBrowser";
import { Page, PageHeader } from "../../shared/Page";
import { StatusBadge } from "../../shared/StatusBadge";
import { formatDateTime } from "../../shared/dates";
import { TextLink } from "../../shared/links";
import {
	createFolder,
	deleteObject,
	fetchAsFile,
	formatSize,
	imageUsage,
	listDirectory,
	moveObject,
	prepareImage,
	renamedToAvoid,
	saveAltText,
	setWebpPreferred,
	storedName,
	uploadPrepared,
	webpPreferred,
	type MediaFile,
	type MediaFolder,
} from "../../shared/media";

const route = getRouteApi("/media");
const VIEW_KEY = "kisdigital:manage:media-view";

type SortBy = "name" | "newest" | "largest";
type View = "grid" | "list";
type Status = { severity: "success" | "error" | "info" | "warning"; text: string };

interface UploadItem {
	id: number;
	name: string;
	state: "waiting" | "uploading" | "done" | "error";
	progress: number;
	message?: string;
}

interface Conflict {
	files: File[];
	taken: Set<string>;
	clashing: string[];
}

function baseName(name: string): string {
	return name.replace(/\.[^.]+$/, "");
}

function folderOf(key: string): string {
	return key.slice(0, key.lastIndexOf("/") + 1);
}

function plural(count: number, one: string, many: string): string {
	return `${count} ${count === 1 ? one : many}`;
}

function useUsage(key: string | undefined) {
	return useQuery({ queryKey: ["media-usage", key], queryFn: () => imageUsage(key!), enabled: Boolean(key), staleTime: 0 });
}

function UsageList({ fileKey }: { fileKey: string }) {
	const usage = useUsage(fileKey);
	if (usage.isPending) {
		return (
			<Typography variant="body2" color="text.secondary">
				Checking which posts use this…
			</Typography>
		);
	}
	if (usage.isError) return <Alert severity="warning">Couldn't check which posts use this image.</Alert>;
	if (usage.data.length === 0) {
		return (
			<Typography variant="body2" color="text.secondary">
				No post uses this image.
			</Typography>
		);
	}
	return (
		<Stack spacing={0.75}>
			<Typography variant="body2" sx={{ fontWeight: 600 }}>
				Used in {plural(usage.data.length, "post", "posts")}
			</Typography>
			{usage.data.map((post) => (
				<Stack key={post.id} direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
					<TextLink to="/posts/$postId/edit" params={{ postId: post.id }} variant="body2" underline="hover" noWrap sx={{ flex: 1 }}>
						{post.title}
					</TextLink>
					<StatusBadge status={post.status} />
				</Stack>
			))}
		</Stack>
	);
}

// ── Viewer ──────────────────────────────────────────────────────────────────

interface LightboxProps {
	images: MediaFile[];
	index: number;
	altAvailable: boolean;
	onIndex: (index: number) => void;
	onCrop: (file: MediaFile) => void;
	onRename: (file: MediaFile) => void;
	onMove: (file: MediaFile) => void;
	onDelete: (file: MediaFile) => void;
	onAltSaved: () => void;
	onClose: () => void;
}

function Lightbox({ images, index, altAvailable, onIndex, onCrop, onRename, onMove, onDelete, onAltSaved, onClose }: LightboxProps) {
	const file = images[index];
	const [copied, setCopied] = useState<"url" | "markdown" | null>(null);
	const [alt, setAlt] = useState(file.alt);
	const [savedAlt, setSavedAlt] = useState(file.alt);
	const [altState, setAltState] = useState<"idle" | "saving" | "saved" | "error">("idle");
	const many = images.length > 1;

	// Only when a different image is shown: the listing refreshes after a
	// save, and that mustn't wipe the "Saved" note.
	useEffect(() => {
		setCopied(null);
		setAlt(file.alt);
		setSavedAlt(file.alt);
		setAltState("idle");
	}, [file.key]);

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			// Arrow keys belong to the alt text field while it has focus.
			if (!many || (e.target as HTMLElement).tagName === "INPUT") return;
			if (e.key === "ArrowLeft") onIndex((index - 1 + images.length) % images.length);
			if (e.key === "ArrowRight") onIndex((index + 1) % images.length);
		}
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [index, images.length, many, onIndex]);

	async function copy(kind: "url" | "markdown") {
		try {
			await navigator.clipboard.writeText(kind === "url" ? file.url : `![${savedAlt || baseName(file.name)}](${file.url})`);
			setCopied(kind);
		} catch {}
	}

	async function saveAlt() {
		setAltState("saving");
		try {
			await saveAltText(file.key, alt.trim());
			setSavedAlt(alt.trim());
			setAltState("saved");
			onAltSaved();
		} catch {
			setAltState("error");
		}
	}

	const navSx = { position: "absolute", top: "50%", transform: "translateY(-50%)", bgcolor: "background.paper", "&:hover": { bgcolor: "background.paper" } };

	return (
		<Dialog open onClose={onClose} maxWidth="lg" fullWidth>
			<Stack direction="row" spacing={0.5} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap", px: 2, py: 1 }}>
				<Box sx={{ flex: 1, minWidth: 160 }}>
					<Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
						{file.name}
					</Typography>
					<Typography variant="caption" color="text.secondary">
						{formatSize(file.size)}
						{file.modified && ` · ${formatDateTime(file.modified)}`}
						{many && ` · ${index + 1} of ${images.length}`}
					</Typography>
				</Box>
				<Button size="small" startIcon={<ContentCopy />} onClick={() => copy("url")}>
					{copied === "url" ? "Copied" : "Copy URL"}
				</Button>
				<Button size="small" startIcon={<ContentCopy />} onClick={() => copy("markdown")}>
					{copied === "markdown" ? "Copied" : "Copy Markdown"}
				</Button>
				{!/\.gif$/i.test(file.name) && (
					<Tooltip title="Crop or rotate">
						<IconButton aria-label="Crop image" onClick={() => onCrop(file)}>
							<Crop />
						</IconButton>
					</Tooltip>
				)}
				<Tooltip title="Rename">
					<IconButton aria-label="Rename image" onClick={() => onRename(file)}>
						<DriveFileRenameOutline />
					</IconButton>
				</Tooltip>
				<Tooltip title="Move to another folder">
					<IconButton aria-label="Move image" onClick={() => onMove(file)}>
						<DriveFileMoveOutlined />
					</IconButton>
				</Tooltip>
				<Tooltip title="Open in a new tab">
					<IconButton component="a" href={file.url} target="_blank" rel="noopener" aria-label="Open in a new tab">
						<OpenInNew />
					</IconButton>
				</Tooltip>
				<Tooltip title="Delete">
					<IconButton color="error" aria-label="Delete image" onClick={() => onDelete(file)}>
						<DeleteOutlined />
					</IconButton>
				</Tooltip>
				<IconButton onClick={onClose} aria-label="Close">
					<Close />
				</IconButton>
			</Stack>
			<Box sx={{ position: "relative", bgcolor: "background.default", display: "flex", justifyContent: "center", minHeight: 240 }}>
				<Box component="img" src={file.url} alt={savedAlt || file.name} sx={{ maxWidth: "100%", maxHeight: "60vh", objectFit: "contain", display: "block" }} />
				{many && (
					<>
						<IconButton aria-label="Previous image" onClick={() => onIndex((index - 1 + images.length) % images.length)} sx={{ ...navSx, left: 8 }}>
							<ChevronLeft />
						</IconButton>
						<IconButton aria-label="Next image" onClick={() => onIndex((index + 1) % images.length)} sx={{ ...navSx, right: 8 }}>
							<ChevronRight />
						</IconButton>
					</>
				)}
			</Box>
			<Stack spacing={2} sx={{ px: 2, py: 2 }}>
				{altAvailable ? (
					<Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
						<TextField
							label="Alt text"
							value={alt}
							placeholder="Describe the image for someone who can't see it"
							helperText={
								altState === "error"
									? "Couldn't save the alt text."
									: altState === "saved"
										? "Saved. It's filled in when this image is inserted into a post."
										: "Filled in automatically when this image is inserted into a post."
							}
							error={altState === "error"}
							slotProps={{ htmlInput: { maxLength: 500 } }}
							onChange={(e) => {
								setAlt(e.target.value);
								setAltState("idle");
							}}
							onKeyDown={(e) => {
								if (e.key === "Enter" && alt.trim() !== savedAlt) saveAlt();
							}}
						/>
						<Button variant="outlined" sx={{ height: 40 }} disabled={alt.trim() === savedAlt} loading={altState === "saving"} onClick={saveAlt}>
							Save
						</Button>
					</Stack>
				) : (
					<Typography variant="caption" color="text.secondary">
						Alt text becomes available once the MediaAlt table is created (db/migrations/0024_add_media_alt.sql).
					</Typography>
				)}
				<UsageList fileKey={file.key} />
			</Stack>
		</Dialog>
	);
}

// ── Dialogs ─────────────────────────────────────────────────────────────────

function SimpleDialog({ title, children, actions, onClose, busy = false }: { title: string; children: ReactNode; actions: ReactNode; onClose: () => void; busy?: boolean }) {
	return (
		<Dialog open onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
			<DialogTitle>{title}</DialogTitle>
			<DialogContent>
				<Stack spacing={2}>{children}</Stack>
			</DialogContent>
			<DialogActions sx={{ px: 3, pb: 2 }}>
				<Button onClick={onClose} disabled={busy} color="inherit">
					Cancel
				</Button>
				{actions}
			</DialogActions>
		</Dialog>
	);
}

function UpdatePostsOption({ checked, onChange, many }: { checked: boolean; onChange: (checked: boolean) => void; many: boolean }) {
	return (
		<Box>
			<FormControlLabel
				control={<Checkbox size="small" checked={checked} onChange={(e) => onChange(e.target.checked)} />}
				label={<Typography variant="body2">Update the posts that use {many ? "these files" : "it"}</Typography>}
			/>
			<Typography variant="caption" color={checked ? "text.secondary" : "warning.main"} sx={{ display: "block", ml: 3.5 }}>
				{checked
					? `${many ? "Their addresses change" : "Its address changes"}. Posts are rewritten to the new one.`
					: `${many ? "Their addresses change" : "Its address changes"}, so posts still linking to the old one will show a broken image.`}
			</Typography>
		</Box>
	);
}

function DeleteFilesDialog({ files, busy, onConfirm, onClose }: { files: MediaFile[]; busy: boolean; onConfirm: () => void; onClose: () => void }) {
	const single = files.length === 1 ? files[0] : null;
	// For several files, only the ones in use are named.
	const usage = useQuery({
		queryKey: ["media-usage-bulk", files.map((file) => file.key)],
		queryFn: async () => {
			const results = await Promise.all(files.map((file) => imageUsage(file.key).catch(() => null)));
			return files.filter((_file, i) => (results[i]?.length ?? 0) > 0);
		},
		staleTime: 0,
	});
	const inUse = usage.data ?? [];

	return (
		<SimpleDialog
			title={single ? "Delete this image?" : `Delete ${files.length} files?`}
			busy={busy}
			onClose={onClose}
			actions={
				// Held back until the check finishes, so a delete is never confirmed blind.
				<Button onClick={onConfirm} disabled={busy || usage.isPending} color="error" variant="contained">
					{inUse.length > 0 ? "Delete anyway" : "Delete permanently"}
				</Button>
			}
		>
			<Typography variant="body2" color="text.secondary">
				{single ? `"${single.name}"` : `${files.length} files`} will be permanently deleted from the image server. This can't be undone.
			</Typography>
			{usage.isPending && (
				<Typography variant="body2" color="text.secondary">
					Checking which posts use {single ? "this" : "these"}…
				</Typography>
			)}
			{inUse.length > 0 && (
				<Alert severity="warning">
					{single
						? "It will show as a broken image in the posts below."
						: `${plural(inUse.length, "file is", "files are")} used in posts and will show as broken images: ${inUse.map((file) => file.name).join(", ")}`}
				</Alert>
			)}
			{single && !usage.isPending && <UsageList fileKey={single.key} />}
		</SimpleDialog>
	);
}

function RenameDialog({ file, busy, onConfirm, onClose }: { file: MediaFile; busy: boolean; onConfirm: (name: string, updatePosts: boolean) => void; onClose: () => void }) {
	const [name, setName] = useState(baseName(file.name));
	const [updatePosts, setUpdatePosts] = useState(true);
	const extension = file.name.slice(baseName(file.name).length);
	const unchanged = !name.trim() || name.trim() === baseName(file.name);
	return (
		<SimpleDialog
			title="Rename image"
			busy={busy}
			onClose={onClose}
			actions={
				<Button variant="contained" disabled={unchanged} loading={busy} onClick={() => onConfirm(name.trim(), updatePosts)}>
					Rename
				</Button>
			}
		>
			<TextField
				label="Name"
				value={name}
				autoFocus
				helperText={`Saved in lowercase with hyphens, and it keeps its ${extension} ending.`}
				onChange={(e) => setName(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && !unchanged) onConfirm(name.trim(), updatePosts);
				}}
			/>
			<UpdatePostsOption checked={updatePosts} onChange={setUpdatePosts} many={false} />
			<UsageList fileKey={file.key} />
		</SimpleDialog>
	);
}

function MoveDialog({ files, from, busy, onConfirm, onClose }: { files: MediaFile[]; from: string; busy: boolean; onConfirm: (toPath: string, updatePosts: boolean) => void; onClose: () => void }) {
	const [dest, setDest] = useState(from);
	const [updatePosts, setUpdatePosts] = useState(true);
	const listing = useQuery({ queryKey: mediaQueryKey(dest), queryFn: () => listDirectory(dest), staleTime: 0 });
	const single = files.length === 1 ? files[0] : null;

	return (
		<Dialog open onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
			<DialogTitle>{single ? `Move "${single.name}"` : `Move ${files.length} files`}</DialogTitle>
			<DialogContent>
				<Stack spacing={2}>
					<MediaBreadcrumbs path={dest} onNavigate={setDest} />
					<Paper sx={{ maxHeight: 240, overflowY: "auto" }}>
						{listing.isPending && (
							<Stack sx={{ alignItems: "center", py: 3 }}>
								<CircularProgress size={24} />
							</Stack>
						)}
						{listing.isError && <Alert severity="error">{errorMessage(listing.error, "Couldn't load this directory.")}</Alert>}
						{listing.data && listing.data.folders.length === 0 && (
							<Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
								No folders in here.
							</Typography>
						)}
						{listing.data && listing.data.folders.length > 0 && (
							<List dense disablePadding>
								{listing.data.folders.map((folder) => (
									<ListItemButton key={folder.prefix} onClick={() => setDest(folder.prefix)}>
										<ListItemIcon sx={{ minWidth: 36 }}>
											<Folder color="primary" fontSize="small" />
										</ListItemIcon>
										<ListItemText primary={folder.name} />
										<ChevronRight fontSize="small" color="action" />
									</ListItemButton>
								))}
							</List>
						)}
					</Paper>
					<UpdatePostsOption checked={updatePosts} onChange={setUpdatePosts} many={!single} />
					{single && <UsageList fileKey={single.key} />}
				</Stack>
			</DialogContent>
			<DialogActions sx={{ px: 3, pb: 2 }}>
				<Button onClick={onClose} disabled={busy} color="inherit">
					Cancel
				</Button>
				<Button variant="contained" disabled={dest === from} loading={busy} onClick={() => onConfirm(dest, updatePosts)}>
					Move to {dest ? dest.replace(/\/$/, "") : "the root folder"}
				</Button>
			</DialogActions>
		</Dialog>
	);
}

// ── Page ────────────────────────────────────────────────────────────────────

const tileSx = {
	display: "flex",
	flexDirection: "column",
	alignItems: "stretch",
	justifyContent: "flex-start",
	border: 1,
	borderColor: "divider",
	borderRadius: 2,
	overflow: "hidden",
	bgcolor: "background.raised",
	textAlign: "left",
	width: "100%",
	"&:hover": { borderColor: "primary.main" },
};

function Media() {
	const path = route.useSearch().path ?? "";
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const fileInput = useRef<HTMLInputElement>(null);
	const cropInput = useRef<HTMLInputElement>(null);
	const nextId = useRef(1);

	const [status, setStatus] = useState<Status | null>(null);
	const [queue, setQueue] = useState<UploadItem[]>([]);
	const [busy, setBusy] = useState(false);
	const [working, setWorking] = useState(false);
	const [dragging, setDragging] = useState(false);
	const [conflict, setConflict] = useState<Conflict | null>(null);
	const [cropping, setCropping] = useState<File | null>(null);
	const [webp, setWebp] = useState(webpPreferred);

	const [query, setQuery] = useState("");
	const [sortBy, setSortBy] = useState<SortBy>("name");
	const [view, setView] = useState<View>(() => {
		try {
			return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid";
		} catch {
			return "grid";
		}
	});
	const [selected, setSelected] = useState<Set<string>>(new Set());

	const [viewingKey, setViewingKey] = useState<string | null>(null);
	const [deleting, setDeleting] = useState<MediaFile[] | null>(null);
	const [renaming, setRenaming] = useState<MediaFile | null>(null);
	const [moving, setMoving] = useState<MediaFile[] | null>(null);
	const [deletingFolder, setDeletingFolder] = useState<MediaFolder | null>(null);

	const listing = useQuery({ queryKey: mediaQueryKey(path), queryFn: () => listDirectory(path), staleTime: 0 });

	useEffect(() => {
		setSelected(new Set());
		setQuery("");
	}, [path]);

	const { folders, files, images } = useMemo(() => {
		const needle = query.trim().toLowerCase();
		const matches = (name: string) => !needle || name.toLowerCase().includes(needle);
		const sorted = [...(listing.data?.files ?? [])].filter((file) => matches(file.name) || matches(file.alt));
		sorted.sort((a, b) => {
			if (sortBy === "newest") return b.modified.localeCompare(a.modified);
			if (sortBy === "largest") return b.size - a.size;
			return a.name.localeCompare(b.name);
		});
		return {
			folders: (listing.data?.folders ?? []).filter((folder) => matches(folder.name)),
			files: sorted,
			images: sorted.filter((file) => file.isImage),
		};
	}, [listing.data, query, sortBy]);

	const selectedFiles = files.filter((file) => selected.has(file.key));
	const viewingIndex = viewingKey ? images.findIndex((file) => file.key === viewingKey) : -1;
	const dialogOpen = Boolean(deleting || renaming || moving);

	function goTo(next: string) {
		setStatus(null);
		navigate({ to: "/media", search: next ? { path: next } : {} });
	}

	function refresh() {
		return queryClient.invalidateQueries({ queryKey: mediaQueryKey(path) });
	}

	function toggleSelected(key: string) {
		setSelected((current) => {
			const next = new Set(current);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	}

	function changeView(next: View) {
		setView(next);
		try {
			localStorage.setItem(VIEW_KEY, next);
		} catch {}
	}

	// ── Uploads ──

	function patchItem(id: number, patch: Partial<UploadItem>) {
		setQueue((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
	}

	async function runUploads(files: File[]) {
		const items: UploadItem[] = files.map((file) => ({ id: nextId.current++, name: file.name, state: "waiting", progress: 0 }));
		setQueue((current) => [...current.filter((item) => item.state !== "done"), ...items]);
		setBusy(true);
		for (let i = 0; i < files.length; i++) {
			const id = items[i].id;
			if (!storedName(files[i])) {
				patchItem(id, { state: "error", message: "Not a JPEG, PNG, WebP or GIF image." });
				continue;
			}
			patchItem(id, { state: "uploading" });
			try {
				await uploadPrepared(files[i], path, (fraction) => patchItem(id, { progress: fraction * 100 }));
				patchItem(id, { state: "done", progress: 100 });
			} catch (err) {
				patchItem(id, { state: "error", message: errorMessage(err, "Upload failed.") });
			}
		}
		setBusy(false);
		refresh();
	}

	// Uploads are stored under a name derived from the file's own, and a
	// second upload of that name replaces the first at the same URL. That's
	// useful on purpose and harmful by accident, so it's always asked. Files
	// are resized and converted first, since converting to WebP changes the
	// name they'll be stored under.
	async function startUpload(list: FileList | File[] | null) {
		const chosen = Array.from(list ?? []);
		if (fileInput.current) fileInput.current.value = "";
		if (chosen.length === 0 || busy) return;
		setStatus({ severity: "info", text: "Preparing images…" });

		let prepared: File[];
		let taken: Set<string>;
		try {
			prepared = await Promise.all(chosen.map((file) => prepareImage(file, webp)));
			const fresh = await queryClient.fetchQuery({ queryKey: mediaQueryKey(path), queryFn: () => listDirectory(path), staleTime: 0 });
			taken = new Set(fresh.files.map((file) => file.name));
		} catch (err) {
			setStatus({ severity: "error", text: errorMessage(err, "Couldn't check this directory before uploading.") });
			return;
		}
		setStatus(null);

		const clashing = prepared.map(storedName).filter((name) => name && taken.has(name));
		if (clashing.length > 0) {
			setConflict({ files: prepared, taken, clashing });
			return;
		}
		runUploads(prepared);
	}

	function resolveConflict(choice: "replace" | "keep" | "skip") {
		if (!conflict) return;
		const { files, taken } = conflict;
		setConflict(null);
		if (choice === "replace") return runUploads(files);
		if (choice === "skip") return runUploads(files.filter((file) => !taken.has(storedName(file))));
		const names = new Set(taken);
		runUploads(
			files.map((file) => {
				if (!names.has(storedName(file))) return file;
				const renamed = renamedToAvoid(file, names);
				names.add(renamed.name);
				return renamed;
			}),
		);
	}

	function chooseForCrop(file: File | undefined) {
		if (cropInput.current) cropInput.current.value = "";
		if (!file) return;
		if (file.type === "image/gif") {
			setStatus({ severity: "warning", text: "A GIF can't be cropped here without losing its animation. Use Upload here instead." });
			return;
		}
		setCropping(file);
	}

	// ── Folders ──

	async function handleNewFolder() {
		const name = window.prompt("New folder name:")?.trim();
		if (!name) return;
		try {
			goTo(await createFolder(path, name));
		} catch (err) {
			setStatus({ severity: "error", text: errorMessage(err, "Could not create the folder.") });
		}
	}

	async function askDeleteFolder(folder: MediaFolder) {
		setStatus(null);
		try {
			const inside = await queryClient.fetchQuery({ queryKey: mediaQueryKey(folder.prefix), queryFn: () => listDirectory(folder.prefix), staleTime: 0 });
			const count = inside.files.length + inside.folders.length;
			if (count > 0) {
				setStatus({ severity: "error", text: `"${folder.name}" isn't empty. Delete or move the ${plural(count, "item", "items")} inside it first.` });
				return;
			}
			setDeletingFolder(folder);
		} catch (err) {
			setStatus({ severity: "error", text: errorMessage(err, "Couldn't check that folder.") });
		}
	}

	async function confirmDeleteFolder(folder: MediaFolder) {
		setWorking(true);
		try {
			await deleteObject(`${folder.prefix}.keep`);
			setStatus({ severity: "success", text: `Deleted "${folder.name}".` });
			await refresh();
		} catch (err) {
			setStatus({ severity: "error", text: errorMessage(err, "Couldn't delete that folder.") });
		} finally {
			setWorking(false);
			setDeletingFolder(null);
		}
	}

	// ── File actions ──

	// Runs one action per file and reports how many worked, so one failure
	// in a batch doesn't hide the rest.
	async function runOnFiles(targets: MediaFile[], action: (file: MediaFile) => Promise<unknown>, done: string) {
		setWorking(true);
		const failures: string[] = [];
		let postsUpdated = 0;
		let updateFailed = false;
		for (const file of targets) {
			try {
				const result = (await action(file)) as { postsUpdated?: number; updateFailed?: boolean } | undefined;
				postsUpdated += result?.postsUpdated ?? 0;
				updateFailed = updateFailed || Boolean(result?.updateFailed);
			} catch (err) {
				failures.push(`${file.name}: ${errorMessage(err, "failed")}`);
			}
		}
		const succeeded = targets.length - failures.length;
		const posts = updateFailed
			? " The posts using it could not be updated, so they still link to the old address."
			: postsUpdated > 0
				? ` ${plural(postsUpdated, "post was", "posts were")} updated to the new address.`
				: "";
		setStatus(
			failures.length
				? { severity: "error", text: `${done} ${succeeded} of ${targets.length}. ${failures.join("; ")}${posts}` }
				: {
						severity: updateFailed ? "warning" : "success",
						text: (targets.length === 1 ? `${done} "${targets[0].name}".` : `${done} ${plural(succeeded, "file", "files")}.`) + posts,
					},
		);
		setSelected(new Set());
		setViewingKey(null);
		setDeleting(null);
		setRenaming(null);
		setMoving(null);
		setWorking(false);
		await refresh();
		if (postsUpdated > 0) queryClient.invalidateQueries({ queryKey: ["post"] });
	}

	// The crop tool works on local files, so an image already on the server
	// is fetched first. Uploading the result goes through the usual name
	// check, which offers to replace the original or keep both.
	async function cropExisting(file: MediaFile) {
		setStatus({ severity: "info", text: "Opening the image…" });
		try {
			setCropping(await fetchAsFile(file));
			setViewingKey(null);
			setStatus(null);
		} catch (err) {
			setStatus({ severity: "error", text: errorMessage(err, "Couldn't open that image.") });
		}
	}

	function onDrag(e: DragEvent, over: boolean) {
		if (!e.dataTransfer.types.includes("Files")) return;
		e.preventDefault();
		setDragging(over);
	}

	const finished = queue.length > 0 && !busy;
	const total = (listing.data?.files.length ?? 0) + (listing.data?.folders.length ?? 0);
	const selecting = selected.size > 0;

	return (
		<Page>
			<PageHeader
				eyebrow="Content"
				title="Media"
				subtitle="Browse the image server and upload files into the current directory."
				actions={
					<>
						<input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(e) => startUpload(e.target.files)} />
						<input ref={cropInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => chooseForCrop(e.target.files?.[0])} />
						<Button variant="outlined" startIcon={<CreateNewFolderOutlined />} onClick={handleNewFolder}>
							New folder
						</Button>
						<Button variant="outlined" startIcon={<Crop />} disabled={busy} onClick={() => cropInput.current?.click()}>
							Crop and upload
						</Button>
						<Button variant="contained" startIcon={<UploadOutlined />} disabled={busy} onClick={() => fileInput.current?.click()}>
							Upload here
						</Button>
					</>
				}
			/>

			{status && (
				<Alert severity={status.severity} sx={{ mb: 2 }} onClose={() => setStatus(null)}>
					{status.text}
				</Alert>
			)}

			{queue.length > 0 && (
				<Paper sx={{ p: 2, mb: 2 }}>
					<Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}>
						<Typography variant="h3">
							{busy ? "Uploading…" : `${queue.filter((item) => item.state === "done").length} of ${queue.length} uploaded`}
						</Typography>
						{finished && (
							<Button size="small" color="inherit" onClick={() => setQueue([])}>
								Dismiss
							</Button>
						)}
					</Stack>
					<Stack spacing={1.25}>
						{queue.map((item) => (
							<Box key={item.id}>
								<Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
									{item.state === "done" && <CheckCircleOutlined fontSize="small" color="success" />}
									{item.state === "error" && <ErrorOutlined fontSize="small" color="error" />}
									<Typography variant="body2" noWrap sx={{ flex: 1 }}>
										{item.name}
									</Typography>
									<Typography variant="caption" color={item.state === "error" ? "error" : "text.secondary"}>
										{item.state === "error" ? item.message : item.state === "waiting" ? "Waiting" : `${Math.round(item.progress)}%`}
									</Typography>
								</Stack>
								{item.state !== "error" && (
									<LinearProgress variant="determinate" value={item.progress} color={item.state === "done" ? "success" : "primary"} sx={{ height: 4, borderRadius: 2 }} />
								)}
							</Box>
						))}
					</Stack>
				</Paper>
			)}

			<Paper
				onDragEnter={(e) => onDrag(e, true)}
				onDragOver={(e) => onDrag(e, true)}
				onDragLeave={(e) => onDrag(e, false)}
				onDrop={(e) => {
					onDrag(e, false);
					startUpload(e.dataTransfer.files);
				}}
				sx={{ p: 2.5, position: "relative", borderStyle: dragging ? "dashed" : "solid", borderColor: dragging ? "primary.main" : "divider", transition: "border-color 120ms" }}
			>
				<Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ alignItems: { md: "center" }, mb: 2 }}>
					<Box sx={{ flex: 1, minWidth: 0 }}>
						<MediaBreadcrumbs path={path} onNavigate={goTo} />
					</Box>
					<TextField
						placeholder="Search this folder"
						value={query}
						sx={{ width: { xs: "100%", md: 220 } }}
						slotProps={{ htmlInput: { "aria-label": "Search this folder" } }}
						onChange={(e) => setQuery(e.target.value)}
					/>
					<TextField select value={sortBy} sx={{ width: { xs: "100%", md: 150 } }} slotProps={{ htmlInput: { "aria-label": "Sort by" } }} onChange={(e) => setSortBy(e.target.value as SortBy)}>
						<MenuItem value="name">Name</MenuItem>
						<MenuItem value="newest">Newest first</MenuItem>
						<MenuItem value="largest">Largest first</MenuItem>
					</TextField>
					<ToggleButtonGroup size="small" exclusive value={view} onChange={(_event, next: View | null) => next && changeView(next)} aria-label="Layout">
						<ToggleButton value="grid" aria-label="Grid">
							<GridViewOutlined fontSize="small" />
						</ToggleButton>
						<ToggleButton value="list" aria-label="List">
							<ViewListOutlined fontSize="small" />
						</ToggleButton>
					</ToggleButtonGroup>
				</Stack>

				<Stack direction="row" spacing={2} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap", minHeight: 40, mb: 1.5 }}>
					{selecting ? (
						<>
							<Typography variant="body2" sx={{ fontWeight: 600 }}>
								{selected.size} selected
							</Typography>
							<Button size="small" startIcon={<DriveFileMoveOutlined />} onClick={() => setMoving(selectedFiles)}>
								Move
							</Button>
							<Button size="small" color="error" startIcon={<DeleteOutlined />} onClick={() => setDeleting(selectedFiles)}>
								Delete
							</Button>
							<Button size="small" color="inherit" onClick={() => setSelected(new Set())}>
								Clear
							</Button>
						</>
					) : (
						<>
							<Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
								{listing.data
									? query
										? `${files.length + folders.length} of ${plural(total, "item", "items")} match`
										: `${plural(total, "item", "items")}. Drop images here to upload them.`
									: ""}
							</Typography>
							{files.length > 0 && (
								<Button size="small" color="inherit" onClick={() => setSelected(new Set(files.map((file) => file.key)))}>
									Select all
								</Button>
							)}
							<Tooltip title="Smaller files at the same quality. A file is only converted when the result is smaller, and GIFs are left alone.">
								<FormControlLabel
									sx={{ mr: 0 }}
									control={
										<Switch
											size="small"
											checked={webp}
											onChange={(e) => {
												setWebp(e.target.checked);
												setWebpPreferred(e.target.checked);
											}}
										/>
									}
									label={<Typography variant="caption">Convert uploads to WebP</Typography>}
								/>
							</Tooltip>
						</>
					)}
				</Stack>

				{listing.isPending && (
					<Stack sx={{ alignItems: "center", py: 6 }}>
						<CircularProgress />
					</Stack>
				)}
				{listing.isError && (
					<Alert severity="error">
						{errorMessage(listing.error, "Couldn't load this directory. Check your connection, and that the storage bucket's CORS rules allow this site's address.")}
					</Alert>
				)}
				{listing.data && files.length === 0 && folders.length === 0 && (
					<Typography color="text.secondary">{query ? "Nothing in this folder matches that." : "This directory is empty."}</Typography>
				)}

				{listing.data && view === "grid" && (
					<Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
						{folders.map((folder) => (
							<Box key={folder.prefix} sx={{ position: "relative", display: "flex", "&:hover .media-hover, &:focus-within .media-hover": { opacity: 1 } }}>
								<ButtonBase sx={{ ...tileSx, p: 2, alignItems: "center", gap: 1 }} onClick={() => goTo(folder.prefix)}>
									<Folder color="primary" sx={{ fontSize: 40 }} />
									<Typography variant="body2" noWrap sx={{ maxWidth: "100%" }}>
										{folder.name}
									</Typography>
								</ButtonBase>
								<Tooltip title="Delete folder">
									<IconButton
										className="media-hover"
										size="small"
										aria-label={`Delete folder ${folder.name}`}
										onClick={() => askDeleteFolder(folder)}
										sx={{ position: "absolute", top: 4, right: 4, opacity: { xs: 1, md: 0 }, transition: "opacity 120ms" }}
									>
										<DeleteOutlined fontSize="small" />
									</IconButton>
								</Tooltip>
							</Box>
						))}
						{files.map((file) => {
							const checked = selected.has(file.key);
							const body = (
								<>
									{file.isImage ? (
										<Box component="img" src={file.url} alt={file.alt || file.name} loading="lazy" sx={{ width: "100%", height: 100, objectFit: "cover", display: "block" }} />
									) : (
										<Stack sx={{ height: 100, alignItems: "center", justifyContent: "center" }}>
											<InsertDriveFileOutlined sx={{ fontSize: 36, color: "text.disabled" }} />
										</Stack>
									)}
									<Box sx={{ p: 1, minWidth: 0 }}>
										<Typography variant="caption" noWrap sx={{ display: "block" }} title={file.name}>
											{file.name}
										</Typography>
										<Typography variant="caption" color="text.secondary">
											{formatSize(file.size)}
										</Typography>
									</Box>
								</>
							);
							return (
								<Box key={file.key} sx={{ position: "relative", display: "flex", "&:hover .media-hover, &:focus-within .media-hover": { opacity: 1 } }}>
									{file.isImage ? (
										<ButtonBase sx={{ ...tileSx, borderColor: checked ? "primary.main" : "divider" }} onClick={() => (selecting ? toggleSelected(file.key) : setViewingKey(file.key))}>
											{body}
										</ButtonBase>
									) : (
										<ButtonBase component="a" href={file.url} target="_blank" rel="noopener" sx={{ ...tileSx, borderColor: checked ? "primary.main" : "divider" }}>
											{body}
										</ButtonBase>
									)}
									<Checkbox
										className="media-hover"
										size="small"
										checked={checked}
										onChange={() => toggleSelected(file.key)}
										slotProps={{ input: { "aria-label": `Select ${file.name}` } }}
										sx={{
											position: "absolute",
											top: 2,
											left: 2,
											p: 0.5,
											borderRadius: 1,
											bgcolor: "background.paper",
											opacity: checked || selecting ? 1 : { xs: 1, md: 0 },
											transition: "opacity 120ms",
											"&:hover": { bgcolor: "background.paper" },
										}}
									/>
								</Box>
							);
						})}
					</Box>
				)}

				{listing.data && view === "list" && (files.length > 0 || folders.length > 0) && (
					<TableContainer>
						<Table size="small">
							<TableHead>
								<TableRow>
									<TableCell padding="checkbox" />
									<TableCell>Name</TableCell>
									<TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Alt text</TableCell>
									<TableCell align="right">Size</TableCell>
									<TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Uploaded</TableCell>
									<TableCell />
								</TableRow>
							</TableHead>
							<TableBody>
								{folders.map((folder) => (
									<TableRow key={folder.prefix} hover sx={{ cursor: "pointer" }} onClick={() => goTo(folder.prefix)}>
										<TableCell padding="checkbox" />
										<TableCell colSpan={4}>
											<Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
												<Folder color="primary" />
												<Typography variant="body2" sx={{ fontWeight: 600 }}>
													{folder.name}
												</Typography>
											</Stack>
										</TableCell>
										<TableCell align="right">
											<Tooltip title="Delete folder">
												<IconButton
													size="small"
													aria-label={`Delete folder ${folder.name}`}
													onClick={(e) => {
														e.stopPropagation();
														askDeleteFolder(folder);
													}}
												>
													<DeleteOutlined fontSize="small" />
												</IconButton>
											</Tooltip>
										</TableCell>
									</TableRow>
								))}
								{files.map((file) => (
									<TableRow key={file.key} hover selected={selected.has(file.key)}>
										<TableCell padding="checkbox">
											<Checkbox size="small" checked={selected.has(file.key)} onChange={() => toggleSelected(file.key)} slotProps={{ input: { "aria-label": `Select ${file.name}` } }} />
										</TableCell>
										<TableCell sx={{ maxWidth: 0, width: "40%" }}>
											<Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
												{file.isImage ? (
													<Box component="img" src={file.url} alt="" loading="lazy" sx={{ width: 40, height: 40, objectFit: "cover", borderRadius: 1, flexShrink: 0 }} />
												) : (
													<InsertDriveFileOutlined sx={{ width: 40, color: "text.disabled", flexShrink: 0 }} />
												)}
												{file.isImage ? (
													<ButtonBase onClick={() => setViewingKey(file.key)} sx={{ minWidth: 0, justifyContent: "flex-start" }}>
														<Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
															{file.name}
														</Typography>
													</ButtonBase>
												) : (
													<Typography component="a" href={file.url} target="_blank" rel="noopener" variant="body2" noWrap color="text.primary" sx={{ fontWeight: 600 }}>
														{file.name}
													</Typography>
												)}
											</Stack>
										</TableCell>
										<TableCell sx={{ display: { xs: "none", md: "table-cell" }, color: "text.secondary", maxWidth: 0, width: "30%" }}>
											<Typography variant="body2" noWrap>
												{file.alt || "—"}
											</Typography>
										</TableCell>
										<TableCell align="right" sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>
											{formatSize(file.size)}
										</TableCell>
										<TableCell sx={{ display: { xs: "none", sm: "table-cell" }, color: "text.secondary", whiteSpace: "nowrap" }}>
											{file.modified ? formatDateTime(file.modified) : "—"}
										</TableCell>
										<TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
											<Tooltip title="Rename">
												<IconButton size="small" aria-label={`Rename ${file.name}`} onClick={() => setRenaming(file)}>
													<DriveFileRenameOutline fontSize="small" />
												</IconButton>
											</Tooltip>
											<Tooltip title="Delete">
												<IconButton size="small" color="error" aria-label={`Delete ${file.name}`} onClick={() => setDeleting([file])}>
													<DeleteOutlined fontSize="small" />
												</IconButton>
											</Tooltip>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</TableContainer>
				)}

				{dragging && (
					<Stack sx={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", bgcolor: "background.paper", opacity: 0.92, borderRadius: "inherit", pointerEvents: "none" }}>
						<UploadOutlined color="primary" sx={{ fontSize: 40 }} />
						<Typography sx={{ fontWeight: 600 }}>Drop to upload into {path || "the root folder"}</Typography>
					</Stack>
				)}
			</Paper>

			{viewingIndex >= 0 && !dialogOpen && (
				<Lightbox
					images={images}
					index={viewingIndex}
					altAvailable={listing.data?.altAvailable ?? false}
					onIndex={(index) => setViewingKey(images[index].key)}
					onCrop={cropExisting}
					onRename={setRenaming}
					onMove={(file) => setMoving([file])}
					onDelete={(file) => setDeleting([file])}
					onAltSaved={refresh}
					onClose={() => setViewingKey(null)}
				/>
			)}

			{deleting && (
				<DeleteFilesDialog files={deleting} busy={working} onClose={() => setDeleting(null)} onConfirm={() => runOnFiles(deleting, (file) => deleteObject(file.key), "Deleted")} />
			)}

			{renaming && (
				<RenameDialog
					file={renaming}
					busy={working}
					onClose={() => setRenaming(null)}
					onConfirm={(name, updatePosts) => runOnFiles([renaming], (file) => moveObject(file.key, { newName: name, updatePosts }), "Renamed")}
				/>
			)}

			{moving && (
				<MoveDialog
					files={moving}
					from={folderOf(moving[0].key)}
					busy={working}
					onClose={() => setMoving(null)}
					onConfirm={(toPath, updatePosts) => runOnFiles(moving, (file) => moveObject(file.key, { toPath, updatePosts }), "Moved")}
				/>
			)}

			{deletingFolder && (
				<SimpleDialog
					title="Delete this folder?"
					busy={working}
					onClose={() => setDeletingFolder(null)}
					actions={
						<Button color="error" variant="contained" disabled={working} onClick={() => confirmDeleteFolder(deletingFolder)}>
							Delete folder
						</Button>
					}
				>
					<Typography variant="body2" color="text.secondary">
						"{deletingFolder.name}" is empty and will be removed.
					</Typography>
				</SimpleDialog>
			)}

			{cropping && (
				<ImageCropper
					file={cropping}
					confirmLabel="Upload"
					onClose={() => setCropping(null)}
					onDone={(cropped) => {
						setCropping(null);
						startUpload([cropped]);
					}}
				/>
			)}

			<Dialog open={conflict !== null} onClose={() => setConflict(null)} maxWidth="sm" fullWidth>
				<DialogTitle>
					{conflict?.clashing.length === 1 ? "A file with this name already exists" : `${conflict?.clashing.length} files already exist here`}
				</DialogTitle>
				<DialogContent>
					<Stack spacing={1.5}>
						<Typography variant="body2" sx={{ fontFamily: "var(--font-mono)", overflowWrap: "anywhere" }}>
							{conflict?.clashing.join(", ")}
						</Typography>
						<Typography variant="body2" color="text.secondary">
							Replacing keeps the same address, so every post using the old image shows the new one. Visitors may still see
							the old image until caches expire. Keeping both uploads the new file under a numbered name.
						</Typography>
					</Stack>
				</DialogContent>
				<DialogActions sx={{ px: 3, pb: 2, flexWrap: "wrap", gap: 1 }}>
					<Button color="inherit" onClick={() => setConflict(null)}>
						Cancel
					</Button>
					{conflict && conflict.files.length > conflict.clashing.length && <Button onClick={() => resolveConflict("skip")}>Skip those</Button>}
					<Button color="warning" onClick={() => resolveConflict("replace")}>
						Replace
					</Button>
					<Button variant="contained" onClick={() => resolveConflict("keep")}>
						Keep both
					</Button>
				</DialogActions>
			</Dialog>
		</Page>
	);
}

export function MediaPage() {
	return (
		<AdminOnly>
			<Media />
		</AdminOnly>
	);
}
