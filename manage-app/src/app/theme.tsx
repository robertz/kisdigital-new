import { useMemo, useSyncExternalStore, type ReactNode } from "react";
import { ThemeProvider, createTheme, type Theme } from "@mui/material/styles";

type Mode = "light" | "dark";

// The values mirror public/assets/css/root.css so the manage app and the
// public site read as one product.
const tokens = {
	light: {
		primary: "#4f46e5",
		background: "#f7f8fb",
		paper: "#ffffff",
		raised: "#f3f5fa",
		divider: "#e4e6eb",
		text: "#111318",
		textSecondary: "#4b5060",
		textDisabled: "#8a8f9c",
		success: "#15803d",
		warning: "#b45309",
		error: "#dc2626",
		info: "#2563eb",
	},
	dark: {
		primary: "#8b8cf8",
		background: "#0f1115",
		paper: "#151922",
		raised: "#1b1f2a",
		divider: "#22262f",
		text: "#e8eaf0",
		textSecondary: "#a3a8b6",
		textDisabled: "#7d8292",
		success: "#4ade80",
		warning: "#fbbf24",
		error: "#f87171",
		info: "#60a5fa",
	},
};

declare module "@mui/material/styles" {
	interface TypeBackground {
		raised: string;
	}
}

function buildTheme(mode: Mode): Theme {
	const t = tokens[mode];
	const fontSans = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

	return createTheme({
		palette: {
			mode,
			primary: { main: t.primary },
			success: { main: t.success },
			warning: { main: t.warning },
			error: { main: t.error },
			info: { main: t.info },
			background: { default: t.background, paper: t.paper, raised: t.raised },
			divider: t.divider,
			text: { primary: t.text, secondary: t.textSecondary, disabled: t.textDisabled },
		},
		shape: { borderRadius: 10 },
		typography: {
			fontFamily: fontSans,
			h1: { fontSize: "1.625rem", fontWeight: 700, letterSpacing: "-0.01em" },
			h2: { fontSize: "1rem", fontWeight: 600 },
			h3: { fontSize: "0.9375rem", fontWeight: 600 },
			overline: { fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", lineHeight: 1.6 },
			button: { textTransform: "none", fontWeight: 600 },
		},
		components: {
			MuiPaper: {
				defaultProps: { elevation: 0, variant: "outlined" },
				styleOverrides: { root: { backgroundImage: "none" } },
			},
			MuiButton: { defaultProps: { disableElevation: true } },
			MuiTextField: { defaultProps: { size: "small", fullWidth: true } },
			MuiTooltip: { defaultProps: { arrow: true } },
			MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
			MuiTableCell: {
				styleOverrides: {
					head: {
						fontSize: "0.6875rem",
						fontWeight: 700,
						letterSpacing: "0.08em",
						textTransform: "uppercase",
						color: t.textSecondary,
					},
				},
			},
			// site.css draws its own focus ring on every input; MUI fields
			// already show focus on their outline.
			MuiInputBase: {
				styleOverrides: {
					input: { "&:focus-visible": { outline: "none" } },
				},
			},
		},
	});
}

function subscribe(onChange: () => void) {
	const observer = new MutationObserver(onChange);
	observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
	return () => observer.disconnect();
}

function currentMode(): Mode {
	return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

/**
 * Follows the site's own light/dark toggle (the data-theme attribute set by
 * views/partials/_head.bxm and _foot.bxm) instead of keeping a second
 * preference.
 */
export function ManageTheme({ children }: { children: ReactNode }) {
	const mode = useSyncExternalStore(subscribe, currentMode);
	const theme = useMemo(() => buildTheme(mode), [mode]);
	return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
