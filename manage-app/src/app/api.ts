import { boot } from "./boot";

export class ApiError extends Error {
	status: number;

	constructor(message: string, status: number) {
		super(message);
		this.status = status;
	}
}

async function request<T>(method: string, path: string, payload?: unknown): Promise<T> {
	const headers: Record<string, string> = {
		Accept: "application/json",
		"X-Requested-With": "XMLHttpRequest",
	};
	if (method !== "GET") headers["X-CSRF-Token"] = boot.csrfToken;
	if (payload !== undefined) headers["Content-Type"] = "application/json";

	const res = await fetch(path, {
		method,
		headers,
		credentials: "same-origin",
		body: payload === undefined ? undefined : JSON.stringify(payload),
	});

	if (res.status === 401) {
		window.location.assign("/manage/login");
		throw new ApiError("Your session has expired.", 401);
	}

	const data = await res.json().catch(() => null);
	if (!res.ok || data === null) {
		throw new ApiError(data?.error ?? data?.message ?? "The request failed.", res.status);
	}
	return data as T;
}

export const api = {
	get: <T>(path: string) => request<T>("GET", path),
	post: <T>(path: string, payload?: unknown) => request<T>("POST", path, payload),
	put: <T>(path: string, payload?: unknown) => request<T>("PUT", path, payload),
	delete: <T>(path: string) => request<T>("DELETE", path),
};

export function errorMessage(err: unknown, fallback: string): string {
	return err instanceof Error && err.message ? err.message : fallback;
}
