import type { ComponentType } from "react";
import type { LinkProps } from "@tanstack/react-router";
import type { SvgIconProps } from "@mui/material/SvgIcon";
import ChatOutlined from "@mui/icons-material/ChatOutlined";
import PhotoLibraryOutlined from "@mui/icons-material/PhotoLibraryOutlined";
import InsightsOutlined from "@mui/icons-material/InsightsOutlined";
import PeopleOutlined from "@mui/icons-material/PeopleOutlined";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import DnsOutlined from "@mui/icons-material/DnsOutlined";
import type { Boot } from "./boot";
import { homeModule } from "../modules/home";
import { postsModule } from "../modules/posts";

export type NavGroup = "Write" | "Readers" | "Admin";

export interface ManageModule {
	id: string;
	label: string;
	icon: ComponentType<SvgIconProps>;
	group?: NavGroup;
	adminOnly?: boolean;
	// The module's first page; its routes are registered in router.tsx.
	to?: LinkProps["to"];
	exact?: boolean;
	// Other top-level paths that should light up this entry.
	alsoActive?: string[];
	// Set instead of `to` for a plain link that leaves the app.
	href?: string;
	badge?: (boot: Boot) => number;
}

// Sidebar order. A new section is a folder under modules/, an entry here,
// and its routes added to router.tsx.
export const modules: ManageModule[] = [
	homeModule,
	postsModule,
	{
		id: "comments",
		label: "Comments",
		icon: ChatOutlined,
		group: "Write",
		adminOnly: true,
		to: "/comments",
		badge: (boot) => boot.pendingComments,
	},
	{ id: "media", label: "Media", icon: PhotoLibraryOutlined, group: "Write", adminOnly: true, to: "/media" },
	{ id: "insights", label: "Insights", icon: InsightsOutlined, group: "Readers", adminOnly: true, to: "/insights" },
	{ id: "authors", label: "Authors", icon: PeopleOutlined, group: "Admin", adminOnly: true, to: "/authors" },
	{ id: "settings", label: "Settings", icon: SettingsOutlined, group: "Admin", adminOnly: true, to: "/settings" },
	// Covers both of its tabs: Server (/server) and Requests (/logs).
	{ id: "system", label: "System", icon: DnsOutlined, group: "Admin", adminOnly: true, to: "/server", alsoActive: ["/logs"] },
];
