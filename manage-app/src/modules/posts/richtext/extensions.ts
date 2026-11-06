import type { AnyExtension } from "@tiptap/core";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { lowlight } from "./code";

/**
 * Everything the post body can hold, shared by the editor and the round-trip
 * check. Posts are stored as Markdown and rendered by models/util/PostRenderer.bx,
 * so the schema sticks to what Markdown can say: an image keeps its title
 * because PostRenderer reads "wide", "half", "inline" and captions from it.
 */
export function postExtensions(extra: AnyExtension[] = []): AnyExtension[] {
	return [
		StarterKit.configure({
			heading: { levels: [2, 3, 4, 5, 6] },
			underline: false,
			codeBlock: false,
			link: { openOnClick: false, autolink: true, linkOnPaste: true, defaultProtocol: "https" },
		}),
		CodeBlockLowlight.configure({ lowlight, defaultLanguage: null, enableTabIndentation: true, tabSize: 4 }),
		Image.configure({ inline: false, allowBase64: false }),
		TableKit.configure({ table: { resizable: false } }),
		Markdown.configure({ indentation: { style: "space", size: 4 } }),
		...extra,
	];
}
