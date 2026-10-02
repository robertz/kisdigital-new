import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { rootRoute } from "../../app/rootRoute";

export const homeRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	component: lazyRouteComponent(() => import("./HomePage"), "HomePage"),
});
