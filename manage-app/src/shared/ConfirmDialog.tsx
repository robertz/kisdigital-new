import type { ReactNode } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";

interface Props {
	open: boolean;
	title: string;
	children: ReactNode;
	confirmLabel: string;
	// "error" for something destructive (the default), "primary" otherwise.
	confirmColor?: "error" | "primary";
	busy?: boolean;
	onConfirm: () => void;
	onClose: () => void;
}

export function ConfirmDialog({ open, title, children, confirmLabel, confirmColor = "error", busy = false, onConfirm, onClose }: Props) {
	return (
		<Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
			<DialogTitle>{title}</DialogTitle>
			<DialogContent>
				<DialogContentText>{children}</DialogContentText>
			</DialogContent>
			<DialogActions sx={{ px: 3, pb: 2 }}>
				<Button onClick={onClose} disabled={busy} color="inherit">
					Cancel
				</Button>
				<Button onClick={onConfirm} disabled={busy} color={confirmColor} variant="contained">
					{confirmLabel}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
