import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

export function Page({ flush = false, children }: { flush?: boolean; children: ReactNode }) {
	return (
		<Box
			component="main"
			sx={{ flex: 1, minWidth: 0, bgcolor: "background.default", p: flush ? 0 : { xs: 2, sm: 3, lg: 4 } }}
		>
			{children}
		</Box>
	);
}

interface HeaderProps {
	eyebrow?: string;
	title: ReactNode;
	subtitle?: ReactNode;
	actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, subtitle, actions }: HeaderProps) {
	return (
		<Stack
			direction={{ xs: "column", sm: "row" }}
			spacing={2}
			sx={{ alignItems: { sm: "flex-end" }, justifyContent: "space-between", mb: 3 }}
		>
			<Box>
				{eyebrow && (
					<Typography variant="overline" color="text.secondary">
						{eyebrow}
					</Typography>
				)}
				<Typography variant="h1">{title}</Typography>
				{subtitle && (
					<Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
						{subtitle}
					</Typography>
				)}
			</Box>
			{actions && (
				<Stack direction="row" spacing={1}>
					{actions}
				</Stack>
			)}
		</Stack>
	);
}
