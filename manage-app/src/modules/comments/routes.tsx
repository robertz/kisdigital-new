import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { rootRoute } from "../../app/rootRoute";

export const commentsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/comments",
	validateSearch: (search: Record<string, unknown>): { page?: number } => {
		const page = Number(search.page);
		return Number.isInteger(page) && page > 1 ? { page } : {};
	},
	component: lazyRouteComponent(() => import("./CommentsPage"), "CommentsPage"),
});
