import { useQuery } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import ButtonBase from "@mui/material/ButtonBase";
import CircularProgress from "@mui/material/CircularProgress";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Folder from "@mui/icons-material/Folder";
import InsertDriveFileOutlined from "@mui/icons-material/InsertDriveFileOutlined";
import { errorMessage } from "../app/api";
import { formatSize, listDirectory, type MediaFile } from "./media";

const tileSx = {
	display: "flex",
	flexDirection: "column",
	alignItems: "stretch",
	justifyContent: "flex-start",
	border: 1,
	borderColor: "divider",
	borderRadius: 2,
	overflow: "hidden",
	bgcolor: "background.raised",
	textAlign: "left",
	"&:hover": { borderColor: "primary.main" },
};

export function mediaQueryKey(path: string) {
	return ["media", path];
}

export function MediaBreadcrumbs({ path, onNavigate }: { path: string; onNavigate: (path: string) => void }) {
	const segments = path.split("/").filter(Boolean);
	return (
		<Breadcrumbs aria-label="Directory path">
			<Link component="button" type="button" underline="hover" color="inherit" onClick={() => onNavigate("")}>
				Root
			</Link>
			{segments.map((segment, i) => (
				<Link
					key={i}
					component="button"
					type="button"
					underline="hover"
					color={i === segments.length - 1 ? "text.primary" : "inherit"}
					onClick={() => onNavigate(`${segments.slice(0, i + 1).join("/")}/`)}
				>
					{segment}
				</Link>
			))}
		</Breadcrumbs>
	);
}

interface Props {
	path: string;
	enabled?: boolean;
	onNavigate: (path: string) => void;
	// Called with the image, plus every image in the directory and its position among them.
	onImage: (file: MediaFile, images: MediaFile[], index: number) => void;
}

/** One directory of the image bucket, for picking an image: folders first, then files. */
export function MediaGrid({ path, enabled = true, onNavigate, onImage }: Props) {
	const listing = useQuery({ queryKey: mediaQueryKey(path), queryFn: () => listDirectory(path), staleTime: 0, enabled });

	if (listing.isPending) {
		return (
			<Stack sx={{ alignItems: "center", py: 6 }}>
				<CircularProgress />
			</Stack>
		);
	}
	if (listing.isError) {
		return (
			<Alert severity="error">
				{errorMessage(
					listing.error,
					"Couldn't load this directory. Check your connection, and that the storage bucket's CORS rules allow this site's address.",
				)}
			</Alert>
		);
	}

	const { folders, files } = listing.data;
	const images = files.filter((file) => file.isImage);

	if (folders.length === 0 && files.length === 0) {
		return <Typography color="text.secondary">This directory is empty.</Typography>;
	}

	return (
		<Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
			{folders.map((folder) => (
				<ButtonBase key={folder.prefix} sx={{ ...tileSx, p: 2, alignItems: "center", gap: 1 }} onClick={() => onNavigate(folder.prefix)}>
					<Folder color="primary" sx={{ fontSize: 40 }} />
					<Typography variant="body2" noWrap sx={{ maxWidth: "100%" }}>
						{folder.name}
					</Typography>
				</ButtonBase>
			))}
			{files.map((file) => {
				const caption = (
					<Box sx={{ p: 1, minWidth: 0 }}>
						<Typography variant="caption" noWrap sx={{ display: "block" }} title={file.name}>
							{file.name}
						</Typography>
						<Typography variant="caption" color="text.secondary">
							{formatSize(file.size)}
						</Typography>
					</Box>
				);
				return file.isImage ? (
					<ButtonBase key={file.key} sx={tileSx} onClick={() => onImage(file, images, images.indexOf(file))}>
						<Box
							component="img"
							src={file.url}
							alt={file.name}
							loading="lazy"
							sx={{ width: "100%", height: 100, objectFit: "cover", display: "block" }}
						/>
						{caption}
					</ButtonBase>
				) : (
					<ButtonBase key={file.key} component="a" href={file.url} target="_blank" rel="noopener" sx={tileSx}>
						<Stack sx={{ height: 100, alignItems: "center", justifyContent: "center" }}>
							<InsertDriveFileOutlined sx={{ fontSize: 36, color: "text.disabled" }} />
						</Stack>
						{caption}
					</ButtonBase>
				);
			})}
		</Box>
	);
}
