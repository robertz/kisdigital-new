import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { rootRoute } from "../../app/rootRoute";

export const postsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/posts",
	validateSearch: (search: Record<string, unknown>): { page?: number } => {
		const page = Number(search.page);
		return Number.isInteger(page) && page > 1 ? { page } : {};
	},
	component: lazyRouteComponent(() => import("./PostsPage"), "PostsPage"),
});

export const postNewRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/posts/new",
	component: lazyRouteComponent(() => import("./PostEditorPage"), "NewPostPage"),
});

export const postCalendarRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/posts/calendar",
	validateSearch: (search: Record<string, unknown>): { month?: string } =>
		typeof search.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(search.month) ? { month: search.month } : {},
	component: lazyRouteComponent(() => import("./CalendarPage"), "CalendarPage"),
});

export const postEditRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/posts/$postId/edit",
	component: lazyRouteComponent(() => import("./PostEditorPage"), "EditPostPage"),
});
