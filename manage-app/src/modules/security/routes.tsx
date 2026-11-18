import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { rootRoute } from "../../app/rootRoute";

export const SECURITY_RANGES = ["24h", "7d", "30d"] as const;
export type SecurityRange = (typeof SECURITY_RANGES)[number];

export const securityRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/security",
	validateSearch: (search: Record<string, unknown>): { range?: SecurityRange } => {
		const range = SECURITY_RANGES.find((r) => r === search.range);
		return range && range !== "7d" ? { range } : {};
	},
	component: lazyRouteComponent(() => import("./SecurityPage"), "SecurityPage"),
});
