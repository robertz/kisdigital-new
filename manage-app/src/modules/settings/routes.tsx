import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { rootRoute } from "../../app/rootRoute";

export const settingsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/settings",
	component: lazyRouteComponent(() => import("./SettingsPage"), "SettingsPage"),
});
