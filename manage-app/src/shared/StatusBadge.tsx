import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import Schedule from "@mui/icons-material/Schedule";
import { formatLocalDateTime } from "./dates";

interface Props {
	status: string;
	isScheduled?: boolean;
	publishDate?: string;
}

export function StatusBadge({ status, isScheduled = false, publishDate = "" }: Props) {
	if (isScheduled) {
		return (
			<Tooltip title={`Goes live ${formatLocalDateTime(publishDate)}`}>
				<Chip size="small" color="info" variant="outlined" icon={<Schedule />} label="Scheduled" />
			</Tooltip>
		);
	}
	if (status === "published") return <Chip size="small" color="success" variant="outlined" label="Published" />;
	if (status === "archived") return <Chip size="small" variant="outlined" label="Archived" />;
	return <Chip size="small" color="warning" variant="outlined" label="Draft" />;
}
