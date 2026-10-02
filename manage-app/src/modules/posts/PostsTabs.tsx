import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import { createLink } from "@tanstack/react-router";

const TabLink = createLink(Tab);

export function PostsTabs({ value }: { value: "list" | "calendar" }) {
	return (
		<Tabs value={value} sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }} aria-label="Posts views">
			<TabLink to="/posts" value="list" label="List" />
			<TabLink to="/posts/calendar" value="calendar" label="Calendar" />
		</Tabs>
	);
}
