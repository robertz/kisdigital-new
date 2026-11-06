/**
 * An image's Markdown title carries its layout for models/util/PostRenderer.bx:
 * one of "wide", "half" or "inline", then an optional caption, as in
 * ![alt](src "wide | A caption"). Without a caption the alt text is shown.
 */
export const IMAGE_SIZES = ["", "wide", "half", "inline"] as const;

export type ImageSize = (typeof IMAGE_SIZES)[number];

export function parseImageTitle(title: string): { size: ImageSize; caption: string } {
	let size: ImageSize = "";
	let work = title;
	for (const hint of ["wide", "half", "inline"] as const) {
		const pattern = new RegExp(`\\b${hint}\\b`, "i");
		if (pattern.test(work)) {
			size = hint;
			work = work.replace(new RegExp(`\\b${hint}\\b`, "gi"), "").trim();
			break;
		}
	}
	const caption = /caption\s*:/i.test(work) ? work.replace(/^.*?caption\s*:\s*/i, "").trim() : work.replace(/^[\s|,]+|[\s|,]+$/g, "");
	return { size, caption };
}

// A double quote would end the Markdown title early.
export function composeImageTitle(size: ImageSize, rawCaption: string): string {
	const caption = rawCaption.replace(/"/g, "\u201d");
	return caption.trim() ? (size ? `${size} | ${caption}` : caption) : size;
}
