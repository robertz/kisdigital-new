import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { rootRoute } from "../../app/rootRoute";

export const authorsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/authors",
	component: lazyRouteComponent(() => import("./AuthorsPage"), "AuthorsPage"),
});

export const authorNewRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/authors/new",
	component: lazyRouteComponent(() => import("./AuthorEditorPage"), "NewAuthorPage"),
});

export const authorEditRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/authors/$authorId/edit",
	component: lazyRouteComponent(() => import("./AuthorEditorPage"), "EditAuthorPage"),
});
