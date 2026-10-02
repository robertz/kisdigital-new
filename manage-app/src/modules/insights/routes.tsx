import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { rootRoute } from "../../app/rootRoute";

export const insightsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/insights",
	component: lazyRouteComponent(() => import("./InsightsPage"), "InsightsPage"),
});
