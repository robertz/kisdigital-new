import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import { createLink } from "@tanstack/react-router";

const TabLink = createLink(Tab);

// Server and Requests share one "System" entry in the sidebar.
export function SystemTabs({ value }: { value: "server" | "logs" }) {
	return (
		<Tabs value={value} sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }} aria-label="System">
			<TabLink to="/server" value="server" label="Server" />
			<TabLink to="/logs" value="logs" label="Requests" />
		</Tabs>
	);
}
