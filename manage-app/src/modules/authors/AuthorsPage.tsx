import { useQuery } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Add from "@mui/icons-material/Add";
import EditOutlined from "@mui/icons-material/EditOutlined";
import { errorMessage } from "../../app/api";
import { AdminOnly } from "../../shared/AdminOnly";
import { Page, PageHeader } from "../../shared/Page";
import { formatDate } from "../../shared/dates";
import { ButtonLink, IconButtonLink, TextLink } from "../../shared/links";
import { authorsApi } from "./api";

function Authors() {
	const authors = useQuery({ queryKey: ["authors"], queryFn: authorsApi.list });

	return (
		<Page>
			<PageHeader
				eyebrow="Admin"
				title="Authors"
				subtitle="Manage who can sign in and write posts."
				actions={
					<ButtonLink to="/authors/new" variant="contained" startIcon={<Add />}>
						New author
					</ButtonLink>
				}
			/>

			{authors.isPending && <Skeleton variant="rounded" height={240} />}
			{authors.isError && <Alert severity="error">{errorMessage(authors.error, "Couldn't load authors.")}</Alert>}
			{authors.data && authors.data.length === 0 && <Alert severity="info">No authors yet.</Alert>}

			{authors.data && authors.data.length > 0 && (
				<Paper sx={{ overflow: "hidden" }}>
					<TableContainer>
						<Table>
							<TableHead>
								<TableRow>
									<TableCell>Name</TableCell>
									<TableCell>Email</TableCell>
									<TableCell>Role</TableCell>
									<TableCell align="right">Posts</TableCell>
									<TableCell>Joined</TableCell>
									<TableCell align="right">Actions</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{authors.data.map((author) => (
									<TableRow key={author.id} hover>
										<TableCell>
											<Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
												<Avatar sx={{ width: 32, height: 32, fontSize: "0.8125rem", bgcolor: "primary.main" }}>
													{author.avatarLabel || author.displayName.slice(0, 2).toUpperCase()}
												</Avatar>
												<TextLink
													to="/authors/$authorId/edit"
													params={{ authorId: author.id }}
													underline="hover"
													color="text.primary"
													sx={{ fontWeight: 600 }}
												>
													{author.displayName}
												</TextLink>
											</Stack>
										</TableCell>
										<TableCell sx={{ color: "text.secondary" }}>{author.email}</TableCell>
										<TableCell>
											<Chip
												size="small"
												variant="outlined"
												color={author.role === "admin" ? "primary" : "default"}
												label={author.role}
											/>
										</TableCell>
										<TableCell align="right" sx={{ color: "text.secondary", fontVariantNumeric: "tabular-nums" }}>
											{author.postCount}
										</TableCell>
										<TableCell sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>{formatDate(author.created)}</TableCell>
										<TableCell align="right">
											<Tooltip title="Edit">
												<IconButtonLink
													to="/authors/$authorId/edit"
													params={{ authorId: author.id }}
													size="small"
													aria-label={`Edit ${author.displayName}`}
												>
													<EditOutlined fontSize="small" />
												</IconButtonLink>
											</Tooltip>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</TableContainer>
				</Paper>
			)}
		</Page>
	);
}

export function AuthorsPage() {
	return (
		<AdminOnly>
			<Authors />
		</AdminOnly>
	);
}
