import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { rootRoute } from "../../app/rootRoute";

export const mediaRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/media",
	validateSearch: (search: Record<string, unknown>): { path?: string } =>
		typeof search.path === "string" && search.path ? { path: search.path } : {},
	component: lazyRouteComponent(() => import("./MediaPage"), "MediaPage"),
});
