import DashboardOutlined from "@mui/icons-material/DashboardOutlined";
import type { ManageModule } from "../../app/modules";

export const homeModule: ManageModule = {
	id: "home",
	label: "Dashboard",
	icon: DashboardOutlined,
	to: "/",
	exact: true,
};
