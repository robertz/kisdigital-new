import type { Editor } from "@tiptap/core";
import { marked } from "marked";

function rendered(markdown: string): string {
	return (marked.parse(markdown.replace(/\r\n?/g, "\n"), { async: false }) as string)
		.replace(/>\s+</g, "><")
		.replace(/\s+/g, " ")
		.replace(/<br ?\/?>/g, "<br>")
		.trim();
}

/**
 * Whether the visual editor can hold this Markdown without changing how the
 * post renders. Raw HTML, spacer <br> lines and some escapes don't survive
 * the trip, so a post that has them opens in the Markdown editor instead.
 */
export function survivesVisualEditing(editor: Editor, markdown: string): boolean {
	const manager = editor.markdown;
	if (!manager || !markdown.trim()) return true;
	try {
		return rendered(manager.serialize(manager.parse(markdown))) === rendered(markdown);
	} catch {
		return false;
	}
}
