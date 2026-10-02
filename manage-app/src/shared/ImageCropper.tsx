import { useEffect, useMemo, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Slider from "@mui/material/Slider";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import RotateLeft from "@mui/icons-material/RotateLeft";
import RotateRight from "@mui/icons-material/RotateRight";

type Shape = "original" | "cover" | "landscape" | "square";

const SHAPES: { id: Shape; label: string; ratio?: number }[] = [
	{ id: "original", label: "Original" },
	// 16:9 is the shape cover images are shown in on the site.
	{ id: "cover", label: "Cover 16:9", ratio: 16 / 9 },
	{ id: "landscape", label: "4:3", ratio: 4 / 3 },
	{ id: "square", label: "Square", ratio: 1 },
];

interface Props {
	file: File;
	initialShape?: Shape;
	confirmLabel?: string;
	onDone: (file: File) => void;
	onClose: () => void;
}

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error("Couldn't read that image."));
		img.src = src;
	});
}

// react-easy-crop reports the crop in pixels of the rotated image, so the
// image is drawn rotated at full size first and the crop is cut from that.
async function render(src: string, area: Area, rotation: number, type: string): Promise<Blob | null> {
	const img = await loadImage(src);
	const quarterTurn = rotation % 180 !== 0;
	const rotated = document.createElement("canvas");
	rotated.width = quarterTurn ? img.height : img.width;
	rotated.height = quarterTurn ? img.width : img.height;
	const ctx = rotated.getContext("2d")!;
	ctx.translate(rotated.width / 2, rotated.height / 2);
	ctx.rotate((rotation * Math.PI) / 180);
	ctx.drawImage(img, -img.width / 2, -img.height / 2);

	const out = document.createElement("canvas");
	out.width = Math.round(area.width);
	out.height = Math.round(area.height);
	out.getContext("2d")!.drawImage(rotated, area.x, area.y, area.width, area.height, 0, 0, out.width, out.height);
	return new Promise((resolve) => out.toBlob(resolve, type, 0.92));
}

/** Crop and rotate one image before it's uploaded. Works on the local file, so nothing is sent until it's confirmed. */
export function ImageCropper({ file, initialShape = "original", confirmLabel = "Use image", onDone, onClose }: Props) {
	const src = useMemo(() => URL.createObjectURL(file), [file]);
	useEffect(() => () => URL.revokeObjectURL(src), [src]);

	const [crop, setCrop] = useState({ x: 0, y: 0 });
	const [zoom, setZoom] = useState(1);
	const [rotation, setRotation] = useState(0);
	const [shape, setShape] = useState<Shape>(initialShape);
	const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
	const [area, setArea] = useState<Area | null>(null);
	const [busy, setBusy] = useState(false);
	const [failure, setFailure] = useState("");

	const quarterTurn = rotation % 180 !== 0;
	const originalRatio = natural ? (quarterTurn ? natural.height / natural.width : natural.width / natural.height) : 1;
	const aspect = SHAPES.find((s) => s.id === shape)?.ratio ?? originalRatio;
	const untouched = shape === "original" && rotation === 0 && zoom === 1;

	async function confirm() {
		if (untouched) return onDone(file);
		if (!area) return;
		setBusy(true);
		try {
			const blob = await render(src, area, rotation, file.type);
			if (!blob) throw new Error("Couldn't process that image.");
			onDone(new File([blob], file.name, { type: file.type }));
		} catch (err) {
			setFailure(err instanceof Error ? err.message : "Couldn't process that image.");
			setBusy(false);
		}
	}

	return (
		<Dialog open onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
			<DialogTitle>Crop and rotate</DialogTitle>
			<Box sx={{ position: "relative", height: { xs: 300, sm: 440 }, bgcolor: "#000" }}>
				<Cropper
					image={src}
					crop={crop}
					zoom={zoom}
					rotation={rotation}
					aspect={aspect}
					onCropChange={setCrop}
					onZoomChange={setZoom}
					onMediaLoaded={(media) => setNatural({ width: media.naturalWidth, height: media.naturalHeight })}
					onCropComplete={(_percent, pixels) => setArea(pixels)}
				/>
			</Box>
			<Stack spacing={2} sx={{ px: 3, pt: 2 }}>
				<Stack direction="row" spacing={2} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
					<ToggleButtonGroup size="small" exclusive value={shape} onChange={(_event, next: Shape | null) => next && setShape(next)} aria-label="Shape">
						{SHAPES.map((item) => (
							<ToggleButton key={item.id} value={item.id} sx={{ px: 1.5, textTransform: "none" }}>
								{item.label}
							</ToggleButton>
						))}
					</ToggleButtonGroup>
					<Stack direction="row">
						<Tooltip title="Rotate left">
							<IconButton aria-label="Rotate left" onClick={() => setRotation((r) => (r + 270) % 360)}>
								<RotateLeft />
							</IconButton>
						</Tooltip>
						<Tooltip title="Rotate right">
							<IconButton aria-label="Rotate right" onClick={() => setRotation((r) => (r + 90) % 360)}>
								<RotateRight />
							</IconButton>
						</Tooltip>
					</Stack>
				</Stack>
				<Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
					<Typography variant="body2" color="text.secondary">
						Zoom
					</Typography>
					<Slider min={1} max={4} step={0.05} value={zoom} aria-label="Zoom" onChange={(_event, value) => setZoom(value as number)} />
				</Stack>
				{failure && (
					<Typography variant="body2" color="error">
						{failure}
					</Typography>
				)}
			</Stack>
			<DialogActions sx={{ px: 3, py: 2 }}>
				<Button color="inherit" onClick={onClose} disabled={busy}>
					Cancel
				</Button>
				<Button variant="contained" onClick={confirm} loading={busy} disabled={!natural}>
					{confirmLabel}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
