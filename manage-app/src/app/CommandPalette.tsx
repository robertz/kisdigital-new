import { useEffect, useMemo, useState, type ComponentType } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate, type LinkProps } from "@tanstack/react-router";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import InputBase from "@mui/material/InputBase";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import Typography from "@mui/material/Typography";
import type { SvgIconProps } from "@mui/material/SvgIcon";
import Add from "@mui/icons-material/Add";
import ArticleOutlined from "@mui/icons-material/ArticleOutlined";
import CalendarMonthOutlined from "@mui/icons-material/CalendarMonthOutlined";
import ListAltOutlined from "@mui/icons-material/ListAltOutlined";
import LogoutOutlined from "@mui/icons-material/LogoutOutlined";
import PersonAddOutlined from "@mui/icons-material/PersonAddOutlined";
import Search from "@mui/icons-material/Search";
import { isAdmin } from "./boot";
import { modules } from "./modules";
import { postsApi } from "../modules/posts/api";

interface Command {
	id: string;
	group: "Go to" | "Actions" | "Posts";
	label: string;
	hint?: string;
	icon: ComponentType<SvgIconProps>;
	run: () => void;
}

function useDebounced<T>(value: T, delay: number): T {
	const [debounced, setDebounced] = useState(value);
	useEffect(() => {
		const timer = window.setTimeout(() => setDebounced(value), delay);
		return () => window.clearTimeout(timer);
	}, [value, delay]);
	return debounced;
}

/** Jump to a page, start something, or find a post by title, from the keyboard. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
	const navigate = useNavigate();
	const [text, setText] = useState("");
	const [active, setActive] = useState(0);
	const needle = text.trim().toLowerCase();
	const searchText = useDebounced(text.trim(), 200);

	const posts = useQuery({
		queryKey: ["post-search", searchText],
		queryFn: () => postsApi.search(searchText),
		enabled: open && searchText.length >= 2,
		placeholderData: keepPreviousData,
	});

	useEffect(() => {
		if (open) {
			setText("");
			setActive(0);
		}
	}, [open]);

	const commands = useMemo(() => {
		const go = (to: LinkProps["to"]) => () => navigate({ to });
		const fixed: Command[] = [
			...modules
				.filter((item) => item.to && (isAdmin || !item.adminOnly))
				.map((item): Command => ({ id: `go-${item.id}`, group: "Go to", label: item.label, icon: item.icon, run: go(item.to) })),
			{ id: "go-calendar", group: "Go to", label: "Post calendar", icon: CalendarMonthOutlined, run: go("/posts/calendar") },
			...(isAdmin ? [{ id: "go-logs", group: "Go to", label: "Request log", icon: ListAltOutlined, run: go("/logs") } satisfies Command] : []),
			{ id: "new-post", group: "Actions", label: "New post", icon: Add, run: go("/posts/new") },
			...(isAdmin ? [{ id: "new-author", group: "Actions", label: "New author", icon: PersonAddOutlined, run: go("/authors/new") } satisfies Command] : []),
			{ id: "sign-out", group: "Actions", label: "Sign out", icon: LogoutOutlined, run: () => window.location.assign("/manage/logout") },
		];
		const found: Command[] =
			searchText.length >= 2 && needle.length >= 2
				? (posts.data ?? []).map((post) => ({
						id: `post-${post.id}`,
						group: "Posts",
						label: post.title,
						hint: post.status,
						icon: ArticleOutlined,
						run: () => navigate({ to: "/posts/$postId/edit", params: { postId: post.id } }),
					}))
				: [];
		return [...fixed.filter((command) => !needle || command.label.toLowerCase().includes(needle)), ...found];
	}, [navigate, needle, searchText, posts.data]);

	const current = Math.min(active, Math.max(commands.length - 1, 0));

	function choose(command: Command | undefined) {
		if (!command) return;
		onClose();
		command.run();
	}

	let lastGroup = "";

	return (
		<Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { position: "fixed", top: "12vh", m: 0 } } }}>
			<Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 2, py: 1.5, borderBottom: 1, borderColor: "divider" }}>
				<Search color="action" />
				<InputBase
					autoFocus
					fullWidth
					value={text}
					placeholder="Go to a page, or search posts by title"
					inputProps={{ "aria-label": "Search commands and posts", role: "combobox", "aria-expanded": true, "aria-controls": "command-list" }}
					onChange={(e) => {
						setText(e.target.value);
						setActive(0);
					}}
					onKeyDown={(e) => {
						if (e.key === "ArrowDown") {
							e.preventDefault();
							setActive((current + 1) % Math.max(commands.length, 1));
						} else if (e.key === "ArrowUp") {
							e.preventDefault();
							setActive((current - 1 + commands.length) % Math.max(commands.length, 1));
						} else if (e.key === "Enter") {
							e.preventDefault();
							choose(commands[current]);
						}
					}}
				/>
			</Box>
			<List id="command-list" role="listbox" dense sx={{ maxHeight: "52vh", overflowY: "auto", py: 0.5 }}>
				{commands.length === 0 && (
					<Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 2 }}>
						{posts.isFetching ? "Searching…" : "Nothing matches that."}
					</Typography>
				)}
				{commands.map((command, i) => {
					const heading = command.group !== lastGroup ? command.group : null;
					lastGroup = command.group;
					const Icon = command.icon;
					return (
						<Box key={command.id}>
							{heading && (
								<ListSubheader disableSticky sx={{ bgcolor: "transparent", lineHeight: "28px", typography: "overline", color: "text.disabled" }}>
									{heading}
								</ListSubheader>
							)}
							<ListItemButton
								role="option"
								aria-selected={i === current}
								selected={i === current}
								onMouseMove={() => setActive(i)}
								onClick={() => choose(command)}
								sx={{ mx: 0.5, borderRadius: 1.5 }}
							>
								<ListItemIcon sx={{ minWidth: 36 }}>
									<Icon fontSize="small" />
								</ListItemIcon>
								<ListItemText primary={command.label} slotProps={{ primary: { noWrap: true } }} />
								{command.hint && (
									<Typography variant="caption" color="text.secondary" sx={{ textTransform: "capitalize" }}>
										{command.hint}
									</Typography>
								)}
							</ListItemButton>
						</Box>
					);
				})}
			</List>
		</Dialog>
	);
}
