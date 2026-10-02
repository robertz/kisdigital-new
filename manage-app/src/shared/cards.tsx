import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { errorMessage } from "../app/api";

export type CountRow = { label: string; count: number };

export function Card({ title, action, children, sx }: { title?: string; action?: ReactNode; children: ReactNode; sx?: object }) {
	return (
		<Paper sx={{ p: 2.5, minWidth: 0, display: "flex", flexDirection: "column", ...sx }}>
			{title && (
				<Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 2 }}>
					<Typography variant="h3" component="h3">
						{title}
					</Typography>
					{action}
				</Stack>
			)}
			{children}
		</Paper>
	);
}

// One place for the loading and failure states every card shares.
export function CardBody<T>({
	query,
	height,
	children,
}: {
	query: UseQueryResult<T>;
	height: number;
	children: (data: T) => ReactNode;
}) {
	if (query.isPending) return <Skeleton variant="rounded" height={height} />;
	if (query.isError) return <Alert severity="error">{errorMessage(query.error, "Couldn't load this.")}</Alert>;
	return <>{children(query.data)}</>;
}

export function Empty({ children }: { children: ReactNode }) {
	return (
		<Typography variant="body2" color="text.secondary">
			{children}
		</Typography>
	);
}

export function BarList({ rows, empty, quoted = false }: { rows: CountRow[] | null; empty: string; quoted?: boolean }) {
	if (rows === null) return <Alert severity="error">Couldn't load this. See the server logs.</Alert>;
	if (rows.length === 0) return <Empty>{empty}</Empty>;
	const max = Math.max(...rows.map((row) => row.count));
	return (
		<Stack spacing={1.5}>
			{rows.map((row) => (
				<Box key={row.label}>
					<Stack direction="row" spacing={2} sx={{ justifyContent: "space-between", mb: 0.5 }}>
						<Typography variant="body2" noWrap title={row.label}>
							{quoted ? `“${row.label}”` : row.label}
						</Typography>
						<Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
							{row.count.toLocaleString()}
						</Typography>
					</Stack>
					<LinearProgress variant="determinate" value={(row.count / max) * 100} sx={{ height: 6, borderRadius: 3 }} />
				</Box>
			))}
		</Stack>
	);
}

