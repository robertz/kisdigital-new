import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import { errorMessage } from "../../app/api";
import { isAdmin } from "../../app/boot";
import { AdminOnly } from "../../shared/AdminOnly";
import { Page, PageHeader } from "../../shared/Page";
import { ButtonLink } from "../../shared/links";
import { authorsApi, type Author, type AuthorInput } from "./api";

function AuthorForm({ author }: { author: Author | null }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [form, setForm] = useState<AuthorInput>({
		displayName: author?.displayName ?? "",
		email: author?.email ?? "",
		role: author?.role ?? "author",
		about: author?.about ?? "",
		avatarLabel: author?.avatarLabel ?? "",
		password: "",
	});
	const [flash, setFlash] = useState<{ severity: "success" | "error"; text: string } | null>(null);

	function update(patch: Partial<AuthorInput>) {
		setForm((current) => ({ ...current, ...patch }));
	}

	const save = useMutation({
		mutationFn: (input: AuthorInput) => (author ? authorsApi.update(author.id, input) : authorsApi.create(input)),
		onSuccess: (saved) => {
			queryClient.invalidateQueries({ queryKey: ["authors"] });
			queryClient.setQueryData(["author", saved.id], saved);
			if (!author) {
				navigate({ to: "/authors/$authorId/edit", params: { authorId: saved.id }, replace: true });
				return;
			}
			update({ password: "" });
			setFlash({ severity: "success", text: "Author saved." });
		},
		onError: (err) => setFlash({ severity: "error", text: errorMessage(err, "Couldn't save the author.") }),
	});

	return (
		<Page>
			<PageHeader
				eyebrow="Admin"
				title={author ? "Edit author" : "New author"}
				subtitle={author ? author.email : "They can sign in as soon as the account is created."}
			/>

			{flash && (
				<Alert severity={flash.severity} sx={{ mb: 2 }} onClose={() => setFlash(null)}>
					{flash.text}
				</Alert>
			)}

			<Paper
				component="form"
				sx={{ p: 3, maxWidth: 880 }}
				onSubmit={(e: FormEvent) => {
					e.preventDefault();
					setFlash(null);
					save.mutate(form);
				}}
			>
				<Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" } }}>
					<TextField
						label="Display name"
						required
						value={form.displayName}
						placeholder="Jane Smith"
						slotProps={{ htmlInput: { maxLength: 50 } }}
						onChange={(e) => update({ displayName: e.target.value })}
					/>
					<TextField
						label="Email"
						type="email"
						required
						value={form.email}
						placeholder="jane@example.com"
						onChange={(e) => update({ email: e.target.value })}
					/>
					<TextField
						select
						label="Role"
						value={form.role}
						disabled={!isAdmin}
						helperText={isAdmin ? undefined : "Only an admin can change roles."}
						onChange={(e) => update({ role: e.target.value })}
					>
						<MenuItem value="author">Author</MenuItem>
						<MenuItem value="admin">Admin</MenuItem>
					</TextField>
					<TextField
						label="Avatar label"
						value={form.avatarLabel}
						placeholder="RZ"
						helperText="Up to 2 characters shown in avatars."
						slotProps={{ htmlInput: { maxLength: 2 } }}
						onChange={(e) => update({ avatarLabel: e.target.value })}
					/>
					<TextField
						label="Bio"
						multiline
						minRows={3}
						value={form.about}
						placeholder="A short bio shown on posts…"
						helperText={`${form.about.length} / 500 characters`}
						slotProps={{ htmlInput: { maxLength: 500 } }}
						sx={{ gridColumn: "1 / -1" }}
						onChange={(e) => update({ about: e.target.value })}
					/>
					<TextField
						label="Password"
						type="password"
						required={!author}
						value={form.password}
						helperText={author ? "Leave blank to keep the current password." : undefined}
						slotProps={{ htmlInput: { autoComplete: "new-password" } }}
						onChange={(e) => update({ password: e.target.value })}
					/>
				</Box>

				<Stack direction="row" spacing={1} sx={{ mt: 3 }}>
					<Button type="submit" variant="contained" startIcon={<SaveOutlined />} loading={save.isPending}>
						{author ? "Save changes" : "Create author"}
					</Button>
					{isAdmin && (
						<ButtonLink to="/authors" color="inherit">
							Cancel
						</ButtonLink>
					)}
				</Stack>
			</Paper>
		</Page>
	);
}

export function NewAuthorPage() {
	return (
		<AdminOnly>
			<AuthorForm key="new" author={null} />
		</AdminOnly>
	);
}

const editRoute = getRouteApi("/authors/$authorId/edit");

// Not admin-only: an author may open and edit their own profile.
export function EditAuthorPage() {
	const { authorId } = editRoute.useParams();
	const author = useQuery({ queryKey: ["author", authorId], queryFn: () => authorsApi.get(authorId) });

	if (author.isPending) {
		return (
			<Page>
				<Skeleton variant="rounded" height={360} />
			</Page>
		);
	}
	if (author.isError) {
		return (
			<Page>
				<Alert severity="error">{errorMessage(author.error, "Couldn't load this author.")}</Alert>
			</Page>
		);
	}
	return <AuthorForm key={author.data.id} author={author.data} />;
}
