import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Close from "@mui/icons-material/Close";
import CreateNewFolderOutlined from "@mui/icons-material/CreateNewFolderOutlined";
import UploadOutlined from "@mui/icons-material/UploadOutlined";
import { boot } from "../app/boot";
import { errorMessage } from "../app/api";
import { MediaBreadcrumbs, MediaGrid, mediaQueryKey } from "./MediaBrowser";
import { createFolder, uploadImage } from "./media";

interface Props {
	open: boolean;
	title: string;
	// `alt` is the image's stored alt text, "" when it has none.
	onPick: (url: string, filename: string, alt: string) => void;
	onClose: () => void;
}

export const defaultUploadPath = `${boot.r2UploadPrefix}/`;

export function ImagePicker({ open, title, onPick, onClose }: Props) {
	const [path, setPath] = useState(defaultUploadPath);
	const [failure, setFailure] = useState("");
	const [busy, setBusy] = useState(false);
	const fileInput = useRef<HTMLInputElement>(null);
	const queryClient = useQueryClient();

	async function handleUpload(file: File | undefined) {
		if (!file) return;
		setBusy(true);
		setFailure("");
		try {
			const url = await uploadImage(file, path);
			queryClient.invalidateQueries({ queryKey: mediaQueryKey(path) });
			onPick(url, file.name, "");
		} catch (err) {
			setFailure(errorMessage(err, "Upload failed. Check your connection and try again."));
		} finally {
			setBusy(false);
			if (fileInput.current) fileInput.current.value = "";
		}
	}

	async function handleNewFolder() {
		const name = window.prompt("New folder name:")?.trim();
		if (!name) return;
		setFailure("");
		try {
			setPath(await createFolder(path, name));
		} catch (err) {
			setFailure(errorMessage(err, "Could not create the folder."));
		}
	}

	return (
		<Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
			<DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
				{title}
				<IconButton onClick={onClose} aria-label="Close" size="small">
					<Close />
				</IconButton>
			</DialogTitle>
			<DialogContent dividers sx={{ minHeight: 360 }}>
				<Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2, flexWrap: "wrap" }} useFlexGap>
					<input
						ref={fileInput}
						type="file"
						accept="image/jpeg,image/png,image/webp,image/gif"
						hidden
						onChange={(e) => handleUpload(e.target.files?.[0])}
					/>
					<Button
						variant="outlined"
						startIcon={busy ? <CircularProgress size={16} /> : <UploadOutlined />}
						disabled={busy}
						onClick={() => fileInput.current?.click()}
					>
						Upload new
					</Button>
					<Button variant="text" startIcon={<CreateNewFolderOutlined />} onClick={handleNewFolder}>
						New folder
					</Button>
					<Box sx={{ ml: 1 }}>
						<MediaBreadcrumbs path={path} onNavigate={setPath} />
					</Box>
				</Stack>

				{failure && (
					<Alert severity="error" sx={{ mb: 2 }}>
						{failure}
					</Alert>
				)}

				<MediaGrid path={path} enabled={open} onNavigate={setPath} onImage={(file) => onPick(file.url, file.name, file.alt)} />
			</DialogContent>
		</Dialog>
	);
}
