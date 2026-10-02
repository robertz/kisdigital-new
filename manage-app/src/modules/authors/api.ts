import { api } from "../../app/api";

export interface Author {
	id: string;
	displayName: string;
	email: string;
	role: "admin" | "author" | string;
	about: string;
	avatarLabel: string;
	postCount: number;
	created: string;
}

export interface AuthorInput {
	displayName: string;
	email: string;
	role: string;
	about: string;
	avatarLabel: string;
	// Blank on an update keeps the current password.
	password: string;
}

export const authorsApi = {
	list: () => api.get<{ authors: Author[] }>("/manage/api/authors").then((r) => r.authors),
	get: (id: string) => api.get<{ author: Author }>(`/manage/api/authors/${encodeURIComponent(id)}`).then((r) => r.author),
	create: (input: AuthorInput) => api.post<{ author: Author }>("/manage/api/authors", input).then((r) => r.author),
	update: (id: string, input: AuthorInput) =>
		api.put<{ author: Author }>(`/manage/api/authors/${encodeURIComponent(id)}`, input).then((r) => r.author),
};
