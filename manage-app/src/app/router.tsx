import { createRouter } from "@tanstack/react-router";
import { rootRoute } from "./rootRoute";
import { authorEditRoute, authorNewRoute, authorsRoute } from "../modules/authors/routes";
import { commentsRoute } from "../modules/comments/routes";
import { homeRoute } from "../modules/home/routes";
import { insightsRoute } from "../modules/insights/routes";
import { mediaRoute } from "../modules/media/routes";
import { postCalendarRoute, postEditRoute, postNewRoute, postsRoute } from "../modules/posts/routes";
import { securityRoute } from "../modules/security/routes";
import { settingsRoute } from "../modules/settings/routes";
import { subscribersRoute } from "../modules/subscribers/routes";
import { logsRoute, serverRoute } from "../modules/system/routes";

const routeTree = rootRoute.addChildren([
	homeRoute,
	postsRoute,
	postNewRoute,
	postCalendarRoute,
	postEditRoute,
	commentsRoute,
	mediaRoute,
	insightsRoute,
	subscribersRoute,
	authorsRoute,
	authorNewRoute,
	authorEditRoute,
	settingsRoute,
	securityRoute,
	serverRoute,
	logsRoute,
]);

export const router = createRouter({
	routeTree,
	basepath: "/manage",
	defaultPreload: "intent",
	scrollRestoration: true,
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
