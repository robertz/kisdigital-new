import ArticleOutlined from "@mui/icons-material/ArticleOutlined";
import type { ManageModule } from "../../app/modules";

export const postsModule: ManageModule = {
	id: "posts",
	label: "Posts",
	icon: ArticleOutlined,
	group: "Write",
	to: "/posts",
};
