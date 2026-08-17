import { build, context } from "esbuild";
import { writeFileSync, mkdirSync, rmSync, readdirSync, unlinkSync } from "fs";
import { basename, join } from "path";

const isDev = process.argv.includes("--dev");
const outdir = "public/assets/dist";

/** Remove all build artifacts from the output directory. */
function cleanDist() {
	try {
		for (const file of readdirSync(outdir)) {
			if (file === "manifest.json" || file.endsWith(".css") || file.endsWith(".js") || file.endsWith(".map")) {
				unlinkSync(join(outdir, file));
			}
		}
	} catch {
		// Directory doesn't exist yet — nothing to clean
	}
	mkdirSync(outdir, { recursive: true });
}

cleanDist();

const sharedOptions = {
	bundle: true,
	minify: !isDev,
	sourcemap: isDev,
	metafile: true,
	outdir,
	logLevel: "info",
};

const cssEntry = { ...sharedOptions, entryPoints: ["public/assets/css/site.css"] };
const jsEntry = {
	...sharedOptions,
	entryPoints: ["public/assets/js/global.js"],
	format: "iife",
	target: ["es2020"],
};

/**
 * Reads esbuild metafile outputs and writes a manifest mapping
 * logical filenames → hashed filenames under /assets/dist/.
 */
function writeManifest(results) {
	const manifest = {};

	for (const result of results) {
		for (const outPath of Object.keys(result.metafile.outputs)) {
			const file = basename(outPath);
			// Strip the hash to get the logical name: site-ABC123.css → site.css
			const logical = file.replace(/-[A-Z0-9]{8}\./, ".");
			manifest[logical] = "/assets/dist/" + file;
		}
	}

	writeFileSync(join(outdir, "manifest.json"), JSON.stringify(manifest, null, 2));
}

// Add content hash to filenames for cache busting
const entryNames = "[name]-[hash]";

/** esbuild plugin that cleans stale artifacts and rewrites the manifest after each rebuild. */
function cleanAndManifestPlugin(getOtherResult) {
	return {
		name: "clean-and-manifest",
		setup(build) {
			build.onEnd((result) => {
				if (result.errors.length) return;
				cleanDist();
				// Re-emit current outputs after clean
				const other = getOtherResult();
				const results = other ? [result, other] : [result];
				writeManifest(results);
			});
		},
	};
}

if (isDev) {
	// Shared state so each plugin can include the other entry's latest result
	let latestCss = null;
	let latestJs = null;

	const cssPlugins = [cleanAndManifestPlugin(() => latestJs)];
	const jsPlugins = [cleanAndManifestPlugin(() => latestCss)];

	const [cssCtx, jsCtx] = await Promise.all([
		context({ ...cssEntry, entryNames, plugins: cssPlugins }),
		context({ ...jsEntry, entryNames, plugins: jsPlugins }),
	]);

	// Initial build to generate manifest
	const [cssResult, jsResult] = await Promise.all([
		cssCtx.rebuild(),
		jsCtx.rebuild(),
	]);
	latestCss = cssResult;
	latestJs = jsResult;
	writeManifest([cssResult, jsResult]);

	await Promise.all([cssCtx.watch(), jsCtx.watch()]);
	console.log("Watching for changes...");
} else {
	// Production build
	const [cssResult, jsResult] = await Promise.all([
		build({ ...cssEntry, entryNames }),
		build({ ...jsEntry, entryNames }),
	]);
	writeManifest([cssResult, jsResult]);
}
