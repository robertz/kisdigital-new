import { Fragment, useEffect, useState } from "react";
import { Outlet, useLocation } from "@tanstack/react-router";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import type { Theme } from "@mui/material/styles";
import ChevronLeft from "@mui/icons-material/ChevronLeft";
import ChevronRight from "@mui/icons-material/ChevronRight";
import LogoutOutlined from "@mui/icons-material/LogoutOutlined";
import Search from "@mui/icons-material/Search";
import { boot, isAdmin } from "./boot";
import { CommandPalette } from "./CommandPalette";
import { modules, type ManageModule } from "./modules";
import { ListItemButtonLink } from "../shared/links";

const COLLAPSED_ATTR = "data-manage-nav-collapsed";
const HEADER_HEIGHT = "var(--site-padding-top, 64px)";

const shortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K";

const itemSx = {
	borderRadius: 2,
	minHeight: 40,
	mb: 0.25,
	px: 1.5,
	color: "text.secondary",
	"&.Mui-selected": { color: "primary.main", "& .MuiListItemIcon-root": { color: "primary.main" } },
};

function NavItem({ item, collapsed }: { item: ManageModule; collapsed: boolean }) {
	const count = item.badge ? item.badge(boot) : 0;
	const Icon = item.icon;
	const pathname = useLocation({ select: (location) => location.pathname });
	const alsoActive = item.alsoActive?.some((path) => pathname === path || pathname.startsWith(`${path}/`)) ?? false;

	const content = (
		<>
			<ListItemIcon sx={{ minWidth: collapsed ? 0 : 36, color: "inherit" }}>
				<Badge color="primary" variant="dot" invisible={!collapsed || count === 0}>
					<Icon fontSize="small" />
				</Badge>
			</ListItemIcon>
			{!collapsed && <ListItemText primary={item.label} slotProps={{ primary: { sx: { fontSize: "0.875rem", fontWeight: 600 } } }} />}
			{!collapsed && count > 0 && <Chip label={count} size="small" color="primary" sx={{ height: 20 }} />}
		</>
	);

	const sx = { ...itemSx, justifyContent: collapsed ? "center" : "flex-start" };
	const button = item.to ? (
		<ListItemButtonLink
			to={item.to}
			activeOptions={{ exact: item.exact ?? false, includeSearch: false }}
			activeProps={{ className: "Mui-selected" }}
			className={alsoActive ? "Mui-selected" : undefined}
			sx={sx}
		>
			{content}
		</ListItemButtonLink>
	) : (
		<ListItemButton component="a" href={item.href} sx={sx}>
			{content}
		</ListItemButton>
	);

	return collapsed ? (
		<Tooltip title={item.label} placement="right">
			{button}
		</Tooltip>
	) : (
		button
	);
}

function Nav({ onSearch }: { onSearch: () => void }) {
	// views/partials/_head.bxm sets this attribute before first paint from the
	// same localStorage key, which the server-rendered manage pages also use.
	const [preferCollapsed, setPreferCollapsed] = useState(
		() => document.documentElement.getAttribute(COLLAPSED_ATTR) === "true",
	);
	const narrow = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
	const collapsed = preferCollapsed || narrow;

	function toggleCollapsed() {
		const next = !preferCollapsed;
		if (next) {
			document.documentElement.setAttribute(COLLAPSED_ATTR, "true");
		} else {
			document.documentElement.removeAttribute(COLLAPSED_ATTR);
		}
		try {
			localStorage.setItem("manageNavCollapsed", next ? "1" : "0");
		} catch {}
		setPreferCollapsed(next);
	}

	const visible = modules.filter((item) => isAdmin || !item.adminOnly);
	let lastGroup: string | undefined;

	return (
		<Box
			component="nav"
			aria-label="Manage"
			sx={{
				width: collapsed ? 64 : 232,
				flexShrink: 0,
				position: "sticky",
				top: HEADER_HEIGHT,
				alignSelf: "flex-start",
				height: `calc(100vh - ${HEADER_HEIGHT})`,
				display: "flex",
				flexDirection: "column",
				bgcolor: "background.paper",
				borderRight: 1,
				borderColor: "divider",
				transition: (theme) => theme.transitions.create("width", { duration: theme.transitions.duration.shorter }),
				overflowX: "hidden",
				overflowY: "auto",
			}}
		>
			<Box
				sx={{
					display: "flex",
					alignItems: "center",
					justifyContent: collapsed ? "center" : "space-between",
					px: collapsed ? 0 : 2.5,
					pt: 2.5,
					pb: 1,
				}}
			>
				{!collapsed && (
					<Typography variant="overline" color="text.secondary" noWrap>
						KISDigital CMS
					</Typography>
				)}
				{!narrow && (
					<IconButton
						size="small"
						aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
						aria-expanded={!collapsed}
						onClick={toggleCollapsed}
					>
						{collapsed ? <ChevronRight fontSize="small" /> : <ChevronLeft fontSize="small" />}
					</IconButton>
				)}
			</Box>

			<Box sx={{ px: 1.5, pb: 0.5 }}>
				<Tooltip title={collapsed ? `Search (${shortcut})` : ""} placement="right">
					<ListItemButton
						onClick={onSearch}
						aria-label="Search"
						sx={{ ...itemSx, border: 1, borderColor: "divider", justifyContent: collapsed ? "center" : "flex-start" }}
					>
						<ListItemIcon sx={{ minWidth: collapsed ? 0 : 36, color: "inherit" }}>
							<Search fontSize="small" />
						</ListItemIcon>
						{!collapsed && <ListItemText primary="Search" slotProps={{ primary: { sx: { fontSize: "0.875rem" } } }} />}
						{!collapsed && (
							<Typography variant="caption" color="text.disabled">
								{shortcut}
							</Typography>
						)}
					</ListItemButton>
				</Tooltip>
			</Box>

			<List sx={{ px: 1.5, flex: 1 }} disablePadding>
				{visible.map((item) => {
					const heading = item.group && item.group !== lastGroup ? item.group : null;
					lastGroup = item.group;
					return (
						<Fragment key={item.id}>
							{heading && !collapsed && (
								<ListSubheader
									disableSticky
									sx={{ bgcolor: "transparent", lineHeight: "32px", mt: 1.5, px: 1.5, typography: "overline", color: "text.disabled" }}
								>
									{heading}
								</ListSubheader>
							)}
							{heading && collapsed && <Box sx={{ height: 12 }} />}
							<NavItem item={item} collapsed={collapsed} />
						</Fragment>
					);
				})}
			</List>

			<List sx={{ px: 1.5, pb: 2 }} disablePadding>
				<NavItem
					collapsed={collapsed}
					item={{ id: "signout", label: "Sign out", icon: LogoutOutlined, href: "/manage/logout" }}
				/>
			</List>
		</Box>
	);
}

export function Shell() {
	const [paletteOpen, setPaletteOpen] = useState(false);

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			// The post editor uses the same keys to insert a link, and has
			// already handled the event when the cursor is in the body.
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && !e.defaultPrevented) {
				e.preventDefault();
				setPaletteOpen((open) => !open);
			}
		}
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, []);

	return (
		<>
			<Nav onSearch={() => setPaletteOpen(true)} />
			<Outlet />
			<CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
		</>
	);
}
