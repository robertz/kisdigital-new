import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView, drawSelection, keymap, placeholder as placeholderExt } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { search, searchKeymap } from "@codemirror/search";
import { tags } from "@lezer/highlight";

export interface MarkdownEditorHandle {
	wrapSelection: (before: string, after?: string) => void;
	prefixLines: (prefix: string, numbered?: boolean) => void;
	insertAtCursor: (text: string) => void;
	focus: () => void;
}

interface Props {
	ref?: Ref<MarkdownEditorHandle>;
	value: string;
	onChange: (value: string) => void;
	onImageFiles?: (files: File[]) => void;
	placeholder?: string;
}

// Colours come from the site's own custom properties, so the editor follows
// the light/dark theme toggle without a second theme to maintain.
const theme = EditorView.theme({
	"&": { color: "var(--post-anchor)", backgroundColor: "transparent", fontSize: "0.9375rem" },
	".cm-scroller": { fontFamily: "var(--font-mono, ui-monospace, monospace)", lineHeight: "1.7" },
	".cm-content": { padding: "var(--space-4)", caretColor: "var(--post-anchor)" },
	".cm-line": { padding: "0" },
	".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--post-anchor)" },
	"&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground": {
		backgroundColor: "color-mix(in srgb, var(--post-link-text) 22%, transparent)",
	},
	".cm-placeholder": { color: "var(--text-placeholder)" },
	".cm-panels": {
		backgroundColor: "var(--ui-surface-2)",
		color: "var(--post-anchor)",
		borderColor: "var(--ui-border-subtle)",
	},
	".cm-searchMatch": { backgroundColor: "color-mix(in srgb, #f59e0b 35%, transparent)" },
	".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "color-mix(in srgb, #f59e0b 65%, transparent)" },
});

const highlight = HighlightStyle.define([
	{ tag: tags.heading1, fontWeight: "700", fontSize: "1.3em" },
	{ tag: tags.heading2, fontWeight: "700", fontSize: "1.15em" },
	{ tag: [tags.heading3, tags.heading4, tags.heading5, tags.heading6], fontWeight: "700" },
	{ tag: tags.strong, fontWeight: "700" },
	{ tag: tags.emphasis, fontStyle: "italic" },
	{ tag: tags.strikethrough, textDecoration: "line-through" },
	{ tag: tags.link, color: "var(--post-link-text)" },
	{ tag: tags.url, color: "var(--text-muted)" },
	{ tag: tags.quote, color: "var(--text-secondary)", fontStyle: "italic" },
	{ tag: tags.monospace, color: "var(--text-secondary)" },
	{ tag: [tags.processingInstruction, tags.meta, tags.contentSeparator], color: "var(--text-muted)" },
	{ tag: [tags.keyword, tags.operatorKeyword, tags.typeName, tags.tagName], color: "var(--post-link-text)" },
	{ tag: [tags.string, tags.number, tags.bool, tags.atom], color: "var(--text-secondary)" },
	{ tag: tags.comment, color: "var(--text-muted)", fontStyle: "italic" },
]);

function wrap(view: EditorView, before: string, after = before) {
	view.dispatch(
		view.state.changeByRange((range) => ({
			changes: [
				{ from: range.from, insert: before },
				{ from: range.to, insert: after },
			],
			range: EditorSelection.range(range.from + before.length, range.to + before.length),
		})),
	);
	view.focus();
	return true;
}

function prefix(view: EditorView, linePrefix: string, numbered = false) {
	const { state } = view;
	const changes = [];
	const seen = new Set<number>();
	for (const range of state.selection.ranges) {
		let counter = 1;
		for (let pos = range.from; pos <= range.to; ) {
			const line = state.doc.lineAt(pos);
			if (!seen.has(line.number)) {
				seen.add(line.number);
				changes.push({ from: line.from, insert: numbered ? `${counter++}. ` : linePrefix });
			}
			pos = line.to + 1;
		}
	}
	view.dispatch({ changes });
	view.focus();
	return true;
}

function imageFiles(list: FileList | undefined | null): File[] {
	return Array.from(list ?? []).filter((file) => file.type.startsWith("image/"));
}

export function MarkdownEditor({ ref, value, onChange, onImageFiles, placeholder = "" }: Props) {
	const host = useRef<HTMLDivElement>(null);
	const viewRef = useRef<EditorView | null>(null);
	const callbacks = useRef({ onChange, onImageFiles });
	callbacks.current = { onChange, onImageFiles };

	useEffect(() => {
		const view = new EditorView({
			parent: host.current!,
			state: EditorState.create({
				doc: value,
				extensions: [
					history(),
					drawSelection(),
					search({ top: true }),
					EditorView.lineWrapping,
					EditorView.contentAttributes.of({ spellcheck: "true", autocapitalize: "sentences" }),
					placeholderExt(placeholder),
					markdown({ base: markdownLanguage, codeLanguages: languages }),
					syntaxHighlighting(highlight),
					theme,
					keymap.of([
						{ key: "Mod-b", run: (v) => wrap(v, "**") },
						{ key: "Mod-i", run: (v) => wrap(v, "_") },
						{ key: "Mod-k", run: (v) => wrap(v, "[", "](https://)") },
						...defaultKeymap,
						...historyKeymap,
						...searchKeymap,
						indentWithTab,
					]),
					EditorView.updateListener.of((update) => {
						if (update.docChanged) callbacks.current.onChange(update.state.doc.toString());
					}),
					EditorView.domEventHandlers({
						paste: (event) => {
							const files = imageFiles(event.clipboardData?.files);
							if (!files.length || !callbacks.current.onImageFiles) return false;
							event.preventDefault();
							callbacks.current.onImageFiles(files);
							return true;
						},
						drop: (event, v) => {
							const files = imageFiles(event.dataTransfer?.files);
							if (!files.length || !callbacks.current.onImageFiles) return false;
							event.preventDefault();
							const pos = v.posAtCoords({ x: event.clientX, y: event.clientY });
							if (pos !== null) v.dispatch({ selection: { anchor: pos } });
							callbacks.current.onImageFiles(files);
							return true;
						},
					}),
				],
			}),
		});
		viewRef.current = view;
		return () => {
			view.destroy();
			viewRef.current = null;
		};
		// The view is created once; later `value` changes are synced below.
	}, []);

	// Only fires for changes that didn't come from typing (restoring a draft).
	useEffect(() => {
		const view = viewRef.current;
		if (!view || view.state.doc.toString() === value) return;
		view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
	}, [value]);

	useImperativeHandle(
		ref,
		() => ({
			wrapSelection: (before, after) => {
				if (viewRef.current) wrap(viewRef.current, before, after);
			},
			prefixLines: (linePrefix, numbered) => {
				if (viewRef.current) prefix(viewRef.current, linePrefix, numbered);
			},
			insertAtCursor: (text) => {
				const view = viewRef.current;
				if (!view) return;
				view.dispatch(view.state.replaceSelection(text));
				view.focus();
			},
			focus: () => viewRef.current?.focus(),
		}),
		[],
	);

	return <div ref={host} className="c-post-editor__cm" />;
}
