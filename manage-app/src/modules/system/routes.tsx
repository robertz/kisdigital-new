import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { rootRoute } from "../../app/rootRoute";

export const serverRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/server",
	component: lazyRouteComponent(() => import("./SystemPage"), "SystemPage"),
});

export interface LogSearch {
	q?: string;
	method?: string;
	status?: string;
	before?: number;
	after?: number;
}

function text(value: unknown): string | undefined {
	return typeof value === "string" && value ? value : undefined;
}

function cursor(value: unknown): number | undefined {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export const logsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/logs",
	validateSearch: (search: Record<string, unknown>): LogSearch => ({
		q: text(search.q),
		method: text(search.method),
		status: text(search.status),
		before: cursor(search.before),
		after: cursor(search.after),
	}),
	component: lazyRouteComponent(() => import("./LogsPage"), "LogsPage"),
});
