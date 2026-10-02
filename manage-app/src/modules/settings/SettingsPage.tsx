import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Check from "@mui/icons-material/Check";
import { api, errorMessage } from "../../app/api";
import { AdminOnly } from "../../shared/AdminOnly";
import { Page, PageHeader } from "../../shared/Page";

interface Setting {
	category: string;
	key: string;
	value: string;
	type: string;
	description: string;
}

function inputKind(type: string): "boolean" | "textarea" | "number" | "text" {
	const lower = type.toLowerCase();
	if (lower === "boolean") return "boolean";
	if (lower === "text" || lower === "json") return "textarea";
	if (lower === "numeric" || lower === "number" || lower === "integer") return "number";
	return "text";
}

function SettingCard({ setting }: { setting: Setting }) {
	const queryClient = useQueryClient();
	const [value, setValue] = useState(setting.value);
	const [saved, setSaved] = useState(setting.value);
	const kind = inputKind(setting.type);
	const label = `${setting.category}.${setting.key}`;

	const save = useMutation({
		mutationFn: (next: string) => api.put("/manage/api/settings", { category: setting.category, key: setting.key, value: next }),
		onSuccess: (_result, next) => {
			setSaved(next);
			queryClient.invalidateQueries({ queryKey: ["settings"] });
		},
	});

	const dirty = value !== saved;

	return (
		<Paper
			component="form"
			sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 1.5, minWidth: 0 }}
			onSubmit={(e) => {
				e.preventDefault();
				if (dirty) save.mutate(value);
			}}
		>
			<Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
				<Typography variant="h3" component="h3" sx={{ fontFamily: "var(--font-mono)", overflowWrap: "anywhere" }}>
					{setting.key}
				</Typography>
				<Chip size="small" label={setting.type} />
			</Stack>
			{setting.description && (
				<Typography variant="body2" color="text.secondary">
					{setting.description}
				</Typography>
			)}
			{kind === "boolean" ? (
				<TextField select value={value} onChange={(e) => setValue(e.target.value)} slotProps={{ htmlInput: { "aria-label": label } }}>
					<MenuItem value="true">true</MenuItem>
					<MenuItem value="false">false</MenuItem>
				</TextField>
			) : (
				<TextField
					value={value}
					type={kind === "number" ? "number" : "text"}
					multiline={kind === "textarea"}
					minRows={kind === "textarea" ? 4 : undefined}
					slotProps={{ htmlInput: { "aria-label": label } }}
					onChange={(e) => setValue(e.target.value)}
				/>
			)}
			{save.isError && <Alert severity="error">{errorMessage(save.error, "Couldn't save this setting.")}</Alert>}
			<Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mt: "auto" }}>
				<Button type="submit" variant="contained" size="small" disabled={!dirty} loading={save.isPending}>
					Update
				</Button>
				{save.isSuccess && !dirty && (
					<Stack direction="row" spacing={0.5} sx={{ alignItems: "center", color: "success.main" }}>
						<Check fontSize="small" />
						<Typography variant="caption">Saved</Typography>
					</Stack>
				)}
			</Stack>
		</Paper>
	);
}

function Settings() {
	const settings = useQuery({
		queryKey: ["settings"],
		queryFn: () => api.get<{ settings: Setting[] }>("/manage/api/settings").then((r) => r.settings),
	});

	const categories: { name: string; items: Setting[] }[] = [];
	for (const setting of settings.data ?? []) {
		const last = categories[categories.length - 1];
		if (last && last.name === setting.category) last.items.push(setting);
		else categories.push({ name: setting.category, items: [setting] });
	}

	return (
		<Page>
			<PageHeader eyebrow="Admin" title="Settings" subtitle="Edit application configuration values. Changes are saved per field." />

			{settings.isPending && <Skeleton variant="rounded" height={320} />}
			{settings.isError && <Alert severity="error">{errorMessage(settings.error, "Couldn't load settings.")}</Alert>}
			{settings.data && settings.data.length === 0 && <Alert severity="info">No settings defined yet.</Alert>}

			{categories.map((category) => (
				<Box component="section" key={category.name} sx={{ mb: 4 }}>
					<Typography variant="overline" color="text.secondary" component="h2" sx={{ display: "block", mb: 1.5 }}>
						{category.name}
					</Typography>
					<Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))" }}>
						{category.items.map((setting) => (
							<SettingCard key={`${setting.category}.${setting.key}`} setting={setting} />
						))}
					</Box>
				</Box>
			))}
		</Page>
	);
}

export function SettingsPage() {
	return (
		<AdminOnly>
			<Settings />
		</AdminOnly>
	);
}
