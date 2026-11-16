import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { rootRoute } from "../../app/rootRoute";

export const SUBSCRIBER_STATUSES = ["active", "pending", "unsubscribed", "bounced", "complained"] as const;
export type SubscriberStatus = (typeof SUBSCRIBER_STATUSES)[number];

export interface SubscriberSearch {
	status?: SubscriberStatus;
	q?: string;
	page?: number;
}

export const subscribersRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/subscribers",
	validateSearch: (search: Record<string, unknown>): SubscriberSearch => {
		const page = Number(search.page);
		const status = SUBSCRIBER_STATUSES.find((s) => s === search.status);
		const q = typeof search.q === "string" && search.q.trim() ? search.q.trim() : undefined;
		return { ...(status ? { status } : {}), ...(q ? { q } : {}), ...(Number.isInteger(page) && page > 1 ? { page } : {}) };
	},
	component: lazyRouteComponent(() => import("./SubscribersPage"), "SubscribersPage"),
});
