import { api } from "../app/api";

const IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "gif"];

export interface MediaFolder {
	prefix: string;
	name: string;
}

export interface MediaFile {
	key: string;
	name: string;
	size: number;
	// ISO timestamp of the last upload to this key.
	modified: string;
	url: string;
	isImage: boolean;
	alt: string;
}

export interface MediaListing {
	path: string;
	folders: MediaFolder[];
	files: MediaFile[];
	// False until the MediaAlt table exists; the alt text field is hidden then.
	altAvailable: boolean;
}

export function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageName(name: string): boolean {
	const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
	return IMAGE_EXT.includes(ext);
}

interface Presigned {
	listUrl: string;
	publicBaseUrl: string;
	path: string;
}

// R2 returns at most 1000 keys per request. 20 pages is a ceiling against a
// listing that never ends, not a size anyone is expected to reach.
const MAX_PAGES = 20;

// The server only presigns; the browser talks to R2 directly for the listing
// and the upload, so file bytes never pass through the app.
export async function listDirectory(path: string): Promise<MediaListing> {
	const altRequest = api
		.get<{ available: boolean; alt: Record<string, string> }>(`/manage/api/media/alt?path=${encodeURIComponent(path)}`)
		.catch(() => ({ available: false, alt: {} as Record<string, string> }));

	const folders: MediaFolder[] = [];
	const files: MediaFile[] = [];
	let resolvedPath = path;
	let token = "";

	for (let page = 0; page < MAX_PAGES; page++) {
		const presigned = await api.get<Presigned>(
			`/manage/api/media/list-url?path=${encodeURIComponent(path)}${token ? `&token=${encodeURIComponent(token)}` : ""}`,
		);
		resolvedPath = presigned.path;
		const res = await fetch(presigned.listUrl);
		if (!res.ok) throw new Error("Could not load this directory.");
		const xml = new DOMParser().parseFromString(await res.text(), "application/xml");

		for (const node of Array.from(xml.getElementsByTagName("CommonPrefixes"))) {
			const prefix = node.getElementsByTagName("Prefix")[0]?.textContent ?? "";
			const name = prefix.slice(presigned.path.length).replace(/\/$/, "");
			if (name) folders.push({ prefix, name });
		}
		for (const node of Array.from(xml.getElementsByTagName("Contents"))) {
			const key = node.getElementsByTagName("Key")[0]?.textContent ?? "";
			const name = key.slice(presigned.path.length);
			// ".keep" is the placeholder createFolder() writes to make an empty folder visible.
			if (!name || name === ".keep") continue;
			files.push({
				key,
				name,
				size: Number(node.getElementsByTagName("Size")[0]?.textContent ?? 0),
				modified: node.getElementsByTagName("LastModified")[0]?.textContent ?? "",
				url: `${presigned.publicBaseUrl}/${key}`,
				isImage: isImageName(name),
				alt: "",
			});
		}

		token = xml.getElementsByTagName("NextContinuationToken")[0]?.textContent ?? "";
		if (xml.getElementsByTagName("IsTruncated")[0]?.textContent !== "true" || !token) break;
	}

	const altText = await altRequest;
	for (const file of files) file.alt = altText.alt[file.key] ?? "";

	return { path: resolvedPath, folders, files, altAvailable: altText.available };
}

const WEBP_KEY = "kisdigital:manage:webp";

/** Whether uploads are converted to WebP. On unless switched off on the Media page. */
export function webpPreferred(): boolean {
	try {
		return localStorage.getItem(WEBP_KEY) !== "0";
	} catch {
		return true;
	}
}

export function setWebpPreferred(on: boolean) {
	try {
		localStorage.setItem(WEBP_KEY, on ? "1" : "0");
	} catch {}
}

function loadImage(file: File): Promise<HTMLImageElement | null> {
	return new Promise((resolve) => {
		const objectUrl = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(objectUrl);
			resolve(img);
		};
		img.onerror = () => {
			URL.revokeObjectURL(objectUrl);
			resolve(null);
		};
		img.src = objectUrl;
	});
}

function encode(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
	return new Promise((resolve) => canvas.toBlob(resolve, type, 0.9));
}

/**
 * Gets a file ready to store: downscaled to 1600px wide, and converted to
 * WebP when that's switched on and actually comes out smaller.
 *
 * 1600px covers a 2x display at full column width; anything larger is wasted
 * bytes. GIFs pass through untouched, because a canvas would flatten them to
 * their first frame. A file the browser can't decode is returned as it is,
 * for the server's own type check to reject.
 */
export async function prepareImage(file: File, webp = webpPreferred(), maxWidth = 1600): Promise<File> {
	if (!TYPE_EXT[file.type.toLowerCase()] || file.type === "image/gif") return file;
	const img = await loadImage(file);
	if (!img) return file;

	const tooWide = img.width > maxWidth;
	const wantsWebp = webp && file.type !== "image/webp";
	if (!tooWide && !wantsWebp) return file;

	const canvas = document.createElement("canvas");
	canvas.width = tooWide ? maxWidth : img.width;
	canvas.height = tooWide ? Math.round(img.height * (maxWidth / img.width)) : img.height;
	canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);

	if (wantsWebp) {
		// A browser that can't encode WebP hands back a PNG instead.
		const converted = await encode(canvas, "image/webp");
		if (converted && converted.type === "image/webp" && (tooWide || converted.size < file.size)) {
			return new File([converted], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
		}
	}
	if (!tooWide) return file;
	const resized = await encode(canvas, file.type);
	return resized ? new File([resized], file.name, { type: file.type }) : file;
}

const TYPE_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

/**
 * The name the server will store an upload under. It mirrors
 * slugifyFilename() in routes/manageapi/Media.bx, which lowercases the name,
 * turns every run of other characters into a hyphen, and takes the extension
 * from the content type. Returns "" for a type the server would refuse.
 */
export function storedName(file: File): string {
	const ext = TYPE_EXT[file.type.toLowerCase()];
	if (!ext) return "";
	const base = file.name.includes(".") ? file.name.slice(0, file.name.lastIndexOf(".")) : file.name;
	const slug = base
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return `${slug || "image"}.${ext}`;
}

/** The same file under the first "-2", "-3"… name that isn't in `taken`. */
export function renamedToAvoid(file: File, taken: Set<string>): File {
	const stored = storedName(file);
	const dot = stored.lastIndexOf(".");
	const base = stored.slice(0, dot);
	const ext = stored.slice(dot);
	let n = 2;
	while (taken.has(`${base}-${n}${ext}`)) n++;
	return new File([file], `${base}-${n}${ext}`, { type: file.type });
}

// XMLHttpRequest rather than fetch, because fetch can't report upload progress.
function putWithProgress(url: string, body: File, contentType: string, onProgress?: (fraction: number) => void): Promise<void> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open("PUT", url);
		xhr.setRequestHeader("Content-Type", contentType);
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
		};
		xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload to the image host failed.")));
		xhr.onerror = () => reject(new Error("Upload to the image host failed. Check your connection."));
		xhr.send(body);
	});
}

/** Uploads a file exactly as given. */
export async function uploadPrepared(file: File, path: string, onProgress?: (fraction: number) => void): Promise<string> {
	const presigned = await api.post<{ uploadUrl: string; url: string }>("/manage/api/media/upload-url", {
		filename: file.name,
		contentType: file.type,
		path,
	});
	await putWithProgress(presigned.uploadUrl, file, file.type, onProgress);
	return presigned.url;
}

/** Prepares (see prepareImage()) and uploads in one step. */
export async function uploadImage(file: File, path: string, onProgress?: (fraction: number) => void): Promise<string> {
	return uploadPrepared(await prepareImage(file), path, onProgress);
}

export interface MediaUsage {
	id: string;
	title: string;
	status: string;
}

export function imageUsage(key: string): Promise<MediaUsage[]> {
	return api.get<{ posts: MediaUsage[] }>(`/manage/api/media/usage?key=${encodeURIComponent(key)}`).then((r) => r.posts);
}

/**
 * Renames a file (newName, without its extension), moves it to another
 * folder (toPath), or both. Its public address changes; updatePosts rewrites
 * the posts that use the old one.
 */
export interface MoveResult {
	key: string;
	url: string;
	postsUpdated: number;
	updateFailed: boolean;
}

export function moveObject(key: string, change: { toPath?: string; newName?: string; updatePosts?: boolean }): Promise<MoveResult> {
	return api.post("/manage/api/media/move", { key, ...change });
}

/**
 * An image already on the image server, as a local file. It comes through
 * this site rather than the public image address, because a canvas can only
 * export an image that was loaded from the page's own origin.
 */
export async function fetchAsFile(file: MediaFile): Promise<File> {
	const res = await fetch(`/manage/api/media/file?key=${encodeURIComponent(file.key)}`, { credentials: "same-origin" });
	if (!res.ok) throw new Error("Couldn't open that image.");
	const blob = await res.blob();
	return new File([blob], file.name, { type: blob.type });
}

export function saveAltText(key: string, alt: string): Promise<unknown> {
	return api.put("/manage/api/media/alt", { key, alt });
}

/** Permanent. An empty folder is removed by deleting its ".keep" marker. */
export function deleteObject(key: string): Promise<unknown> {
	return api.post("/manage/api/media/delete", { key });
}

export async function createFolder(path: string, name: string): Promise<string> {
	const presigned = await api.post<{ uploadUrl: string; path: string }>("/manage/api/media/create-folder", { path, name });
	const res = await fetch(presigned.uploadUrl, {
		method: "PUT",
		headers: { "Content-Type": "application/x-directory" },
		body: "",
	});
	if (!res.ok) throw new Error("Could not create the folder.");
	return presigned.path;
}
