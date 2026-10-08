import { api } from "../../app/api";

export interface PostSummary {
	id: string;
	title: string;
	slug: string;
	status: string;
	featured: boolean;
	publishDate: string;
	isScheduled: boolean;
	postUrl: string;
	tags: string[];
	authorName: string;
	views: number;
}

export interface Post extends PostSummary {
	description: string;
	coverImage: string;
	body: string;
}

export interface PostPage {
	posts: PostSummary[];
	total: number;
	page: number;
	totalPages: number;
}

export interface PostInput {
	title: string;
	slug: string;
	description: string;
	coverImage: string;
	body: string;
	status: string;
	featured: boolean;
	publishDate: string;
	tags: string[];
}

export interface RevisionSummary {
	id: number;
	kind: "save" | "autosave";
	created: string;
	userName: string;
	title: string;
	words: number;
}

export interface Revision {
	id: number;
	kind: "save" | "autosave";
	created: string;
	title: string;
	description: string;
	coverImage: string;
	body: string;
	tags: string[];
}

export interface CalendarPost {
	id: string;
	title: string;
	status: string;
	publishDate: string;
	isScheduled: boolean;
}

export interface CalendarMonth {
	month: string;
	posts: CalendarPost[];
	drafts: { id: string; title: string }[];
}

// Only a draft or an archived post can be deleted; the server enforces the same rule.
export function canDelete(post: Pick<PostSummary, "status">): boolean {
	return post.status !== "published";
}

export const postsApi = {
	list: (page: number) => api.get<PostPage>(`/manage/api/posts?page=${page}`),
	get: (id: string) => api.get<{ post: Post }>(`/manage/api/posts/${encodeURIComponent(id)}`).then((r) => r.post),
	create: (input: PostInput) => api.post<{ post: Post }>("/manage/api/posts", input).then((r) => r.post),
	update: (id: string, input: PostInput) =>
		api.put<{ post: Post }>(`/manage/api/posts/${encodeURIComponent(id)}`, input).then((r) => r.post),
	remove: (id: string) => api.delete<{ deleted: boolean }>(`/manage/api/posts/${encodeURIComponent(id)}`),
	toggleFeatured: (id: string) =>
		api.post<{ featured: boolean }>(`/manage/api/posts/${encodeURIComponent(id)}/featured`),
	tags: () => api.get<{ tags: string[] }>("/manage/api/tags").then((r) => r.tags),
	search: (text: string) =>
		api.get<{ posts: { id: string; title: string; status: string }[] }>(`/manage/api/posts/search?q=${encodeURIComponent(text)}`).then((r) => r.posts),
	// from/to are the month's bounds in the browser's time zone, as UTC.
	calendar: (month: string, from: string, to: string) =>
		api.get<CalendarMonth>(`/manage/api/posts/calendar?month=${month}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
	schedule: (id: string, publishDate: string) =>
		api.post<{ post: PostSummary }>(`/manage/api/posts/${encodeURIComponent(id)}/schedule`, { publishDate }).then((r) => r.post),
	// Keeps unsaved work on the server without changing the post. Resolves
	// false when the server has nowhere to keep it.
	autosave: (id: string, input: PostInput) =>
		api.put<{ saved: boolean }>(`/manage/api/posts/${encodeURIComponent(id)}/autosave`, input).then((r) => r.saved),
	revisions: (id: string) =>
		api.get<{ available: boolean; revisions: RevisionSummary[] }>(`/manage/api/posts/${encodeURIComponent(id)}/revisions`),
	revision: (id: string, revisionId: number) =>
		api.get<{ revision: Revision }>(`/manage/api/posts/${encodeURIComponent(id)}/revisions/${revisionId}`).then((r) => r.revision),
	preview: (body: string) => api.post<{ html: string }>("/manage/api/preview", { body }).then((r) => r.html),
};
