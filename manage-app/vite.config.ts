import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

// The page itself is always served by BoxLang (views/manage/app.bxm), never
// by Vite: a build writes hashed files plus a manifest that routes/ManageApp.bx
// reads, and the dev server is only a script origin the shell points at when
// MANAGE_DEV_SERVER is set.
export default defineConfig(({ command }) => ({
	root,
	base: command === "build" ? "/assets/dist/manage/" : "/",
	publicDir: false,
	plugins: [react()],
	build: {
		outDir: "../public/assets/dist/manage",
		emptyOutDir: true,
		manifest: "manifest.json",
		rolldownOptions: {
			input: "src/main.tsx",
		},
	},
	server: {
		port: 5173,
		strictPort: true,
		origin: "http://localhost:5173",
		cors: true,
	},
}));
