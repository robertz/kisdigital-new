import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Close from "@mui/icons-material/Close";
import { errorMessage } from "../../app/api";
import { formatDateTime } from "../../shared/dates";
import { postsApi, type Revision } from "./api";

interface Props {
	postId: string;
	open: boolean;
	onRestore: (revision: Revision) => void;
	onClose: () => void;
}

/** A post's saved versions, newest first, with the unsaved autosave on top when there is one. */
export function HistoryDrawer({ postId, open, onRestore, onClose }: Props) {
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const history = useQuery({ queryKey: ["revisions", postId], queryFn: () => postsApi.revisions(postId), enabled: open, staleTime: 0 });
	const revision = useQuery({
		queryKey: ["revision", postId, selectedId],
		queryFn: () => postsApi.revision(postId, selectedId!),
		enabled: open && selectedId !== null,
	});

	return (
		<Drawer anchor="right" open={open} onClose={onClose} slotProps={{ paper: { sx: { width: { xs: "100%", sm: 460 }, display: "flex", flexDirection: "column" } } }}>
			<Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", px: 2.5, py: 2, borderBottom: 1, borderColor: "divider" }}>
				<Typography variant="h2">History</Typography>
				<IconButton onClick={onClose} aria-label="Close history" size="small">
					<Close />
				</IconButton>
			</Stack>

			{history.isPending && (
				<Stack sx={{ alignItems: "center", py: 6 }}>
					<CircularProgress />
				</Stack>
			)}
			{history.isError && (
				<Alert severity="error" sx={{ m: 2 }}>
					{errorMessage(history.error, "Couldn't load this post's history.")}
				</Alert>
			)}
			{history.data && !history.data.available && (
				<Alert severity="info" sx={{ m: 2 }}>
					History becomes available once the PostRevision table is created (db/migrations/0025_add_post_revision.sql).
				</Alert>
			)}
			{history.data?.available && history.data.revisions.length === 0 && (
				<Typography variant="body2" color="text.secondary" sx={{ p: 2.5 }}>
					No versions yet. One is kept each time this post is saved.
				</Typography>
			)}

			{history.data && history.data.revisions.length > 0 && (
				<List disablePadding sx={{ overflowY: "auto", flex: selectedId === null ? 1 : "0 0 38%", borderBottom: 1, borderColor: "divider" }}>
					{history.data.revisions.map((item) => (
						<ListItemButton key={item.id} selected={item.id === selectedId} onClick={() => setSelectedId(item.id)} sx={{ px: 2.5 }}>
							<ListItemText
								primary={
									<Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
										<span>{formatDateTime(item.created)}</span>
										{item.kind === "autosave" && <Chip size="small" color="warning" variant="outlined" label="Unsaved draft" sx={{ height: 20 }} />}
									</Stack>
								}
								secondary={`${item.userName || "Unknown"} · ${item.words.toLocaleString()} words`}
								slotProps={{ primary: { variant: "body2", sx: { fontWeight: 600 } } }}
							/>
						</ListItemButton>
					))}
				</List>
			)}

			{selectedId !== null && (
				<Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
					{revision.isPending && (
						<Stack sx={{ alignItems: "center", py: 4 }}>
							<CircularProgress size={24} />
						</Stack>
					)}
					{revision.isError && (
						<Alert severity="error" sx={{ m: 2 }}>
							{errorMessage(revision.error, "Couldn't load that version.")}
						</Alert>
					)}
					{revision.data && (
						<>
							<Box sx={{ flex: 1, overflowY: "auto", px: 2.5, py: 2 }}>
								<Typography variant="h3" sx={{ mb: 1 }}>
									{revision.data.title || "Untitled"}
								</Typography>
								{revision.data.tags.length > 0 && (
									<Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
										Tags: {revision.data.tags.join(", ")}
									</Typography>
								)}
								<Box
									component="pre"
									sx={{ m: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "var(--font-mono)", fontSize: "0.8125rem", lineHeight: 1.6 }}
								>
									{revision.data.body}
								</Box>
							</Box>
							<Stack spacing={1} sx={{ p: 2, borderTop: 1, borderColor: "divider" }}>
								<Button variant="contained" onClick={() => onRestore(revision.data)}>
									Restore this version
								</Button>
								<Typography variant="caption" color="text.secondary">
									It replaces what's in the editor. Nothing is published until you save.
								</Typography>
							</Stack>
						</>
					)}
				</Box>
			)}
		</Drawer>
	);
}
