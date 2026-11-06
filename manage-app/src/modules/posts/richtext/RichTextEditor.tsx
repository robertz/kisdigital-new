import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import Placeholder from "@tiptap/extension-placeholder";
import { NodeSelection } from "@tiptap/pm/state";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Popover from "@mui/material/Popover";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Code from "@mui/icons-material/Code";
import DataObject from "@mui/icons-material/DataObject";
import FormatBold from "@mui/icons-material/FormatBold";
import FormatItalic from "@mui/icons-material/FormatItalic";
import FormatListBulleted from "@mui/icons-material/FormatListBulleted";
import FormatListNumbered from "@mui/icons-material/FormatListNumbered";
import FormatQuote from "@mui/icons-material/FormatQuote";
import FormatStrikethrough from "@mui/icons-material/FormatStrikethrough";
import HorizontalRule from "@mui/icons-material/HorizontalRule";
import ImageOutlined from "@mui/icons-material/ImageOutlined";
import InsertLink from "@mui/icons-material/InsertLink";
import LinkOff from "@mui/icons-material/LinkOff";
import { LANGUAGES, pickerLanguage } from "./code";
import { postExtensions } from "./extensions";
import { composeImageTitle, parseImageTitle, IMAGE_SIZES, type ImageSize } from "./imageTitle";

interface Options {
	value: string;
	onChange: (markdown: string) => void;
	placeholder: string;
	/** Uploads one pasted or dropped image and answers its public address. */
	upload: (file: File) => Promise<string>;
	/** Off while another editor has the body: changes from it are read in once this is back on. */
	active: boolean;
}

/**
 * The visual body editor. The post stays Markdown: what's typed is written
 * back out as Markdown on every change, and a body changed from outside (a
 * restored version, the Markdown editor) is read back in. The body is only
 * rewritten once something is edited here, so opening a post never changes it.
 */
export function usePostEditor({ value, onChange, placeholder, upload, active }: Options) {
	const emitted = useRef(value);
	const change = useRef(onChange);
	const send = useRef(upload);
	const current = useRef<Editor | null>(null);
	useEffect(() => {
		change.current = onChange;
		send.current = upload;
	});

	const editor = useEditor({
		extensions: postExtensions([Placeholder.configure({ placeholder })]),
		content: value,
		contentType: "markdown",
		shouldRerenderOnTransaction: false,
		editorProps: {
			attributes: { class: "c-post__body c-rich-editor__text", "aria-label": "Post body", role: "textbox", "aria-multiline": "true" },
			handlePaste: (view, event) => {
				const files = imageFiles(event.clipboardData?.files);
				if (!files.length) return false;
				event.preventDefault();
				insertUploads(view.state.selection.from, files);
				return true;
			},
			handleDrop: (view, event, _slice, moved) => {
				const files = moved ? [] : imageFiles(event.dataTransfer?.files);
				if (!files.length) return false;
				event.preventDefault();
				const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? view.state.selection.from;
				insertUploads(at, files);
				return true;
			},
		},
		onUpdate: ({ editor }) => {
			const markdown = editor.getMarkdown();
			emitted.current = markdown;
			change.current(markdown);
		},
	});

	current.current = editor;

	async function insertUploads(at: number, files: File[]) {
		let pos = at;
		for (const file of files) {
			const src = await send.current(file).catch(() => "");
			const editor = current.current;
			if (!src || !editor || editor.isDestroyed) continue;
			const alt = file.name.replace(/\.[^.]+$/, "");
			editor.chain().insertContentAt(pos, { type: "image", attrs: { src, alt } }).run();
			pos = editor.state.selection.to;
		}
	}

	useEffect(() => {
		if (!active || !editor || editor.isDestroyed || value === emitted.current) return;
		emitted.current = value;
		editor.commands.setContent(value, { contentType: "markdown", emitUpdate: false });
	}, [active, editor, value]);

	return editor;
}

function imageFiles(list: FileList | undefined | null): File[] {
	return Array.from(list ?? []).filter((file) => file.type.startsWith("image/"));
}

export function insertImage(editor: Editor, src: string, alt: string) {
	editor.chain().focus().insertContent({ type: "image", attrs: { src, alt } }).run();
}

export function PostEditorContent({ editor }: { editor: Editor }) {
	return (
		<>
			<EditorContent editor={editor} className="c-rich-editor" />
			<BubbleMenu
				editor={editor}
				pluginKey="imageSettings"
				shouldShow={({ state }) => state.selection instanceof NodeSelection && state.selection.node.type.name === "image"}
				options={{ placement: "bottom" }}
			>
				<ImageSettings editor={editor} />
			</BubbleMenu>
			<BubbleMenu
				editor={editor}
				pluginKey="codeLanguage"
				shouldShow={({ editor }) => editor.isActive("codeBlock")}
				getReferencedVirtualElement={() => codeBlockAtCursor(editor)}
				options={{ placement: "top-end", offset: 4, flip: false }}
			>
				<CodeLanguagePicker editor={editor} />
			</BubbleMenu>
		</>
	);
}

const BLOCKS = [
	{ id: "p", label: "Paragraph" },
	{ id: "h2", label: "Heading" },
	{ id: "h3", label: "Subheading" },
	{ id: "h4", label: "Minor heading" },
] as const;

type BlockId = (typeof BLOCKS)[number]["id"];

/** The formatting bar over the visual editor. */
export function FormatToolbar({ editor, onInsertImage }: { editor: Editor; onInsertImage: () => void }) {
	const active = useEditorState({
		editor,
		selector: ({ editor }) => ({
			block: (editor.isActive("heading", { level: 2 })
				? "h2"
				: editor.isActive("heading", { level: 3 })
					? "h3"
					: editor.isActive("heading", { level: 4 })
						? "h4"
						: "p") as BlockId,
			inHeading: editor.isActive("heading"),
			bold: editor.isActive("bold"),
			italic: editor.isActive("italic"),
			strike: editor.isActive("strike"),
			code: editor.isActive("code"),
			bulletList: editor.isActive("bulletList"),
			orderedList: editor.isActive("orderedList"),
			blockquote: editor.isActive("blockquote"),
			codeBlock: editor.isActive("codeBlock"),
			link: editor.isActive("link"),
		}),
	});
	const [linkAnchor, setLinkAnchor] = useState<HTMLElement | null>(null);
	const linkButton = useRef<HTMLButtonElement>(null);
	const chain = () => editor.chain().focus();
	const mod = navigator.platform.toLowerCase().includes("mac") ? "⌘" : "Ctrl+";

	function setBlock(id: BlockId) {
		if (id === "p") chain().setParagraph().run();
		else chain().setHeading({ level: Number(id.slice(1)) as 2 | 3 | 4 }).run();
	}

	return (
		<Stack direction="row" spacing={0.25} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }} role="toolbar" aria-label="Formatting">
			<Select
				size="small"
				value={active.block}
				onChange={(e) => setBlock(e.target.value as BlockId)}
				inputProps={{ "aria-label": "Text style" }}
				sx={{ minWidth: 132, mr: 0.5, "& .MuiSelect-select": { py: 0.5, fontSize: "0.875rem" } }}
				// Keeps the editor's selection while the menu is open.
				MenuProps={{ disableAutoFocus: true, disableRestoreFocus: true }}
			>
				{BLOCKS.map((block) => (
					<MenuItem key={block.id} value={block.id}>
						{block.label}
					</MenuItem>
				))}
			</Select>
			<Sep />
			<Tool label="Bold" keys={`${mod}B`} on={active.bold} run={() => chain().toggleBold().run()}>
				<FormatBold fontSize="small" />
			</Tool>
			<Tool label="Italic" keys={`${mod}I`} on={active.italic} run={() => chain().toggleItalic().run()}>
				<FormatItalic fontSize="small" />
			</Tool>
			<Tool label="Strikethrough" on={active.strike} run={() => chain().toggleStrike().run()}>
				<FormatStrikethrough fontSize="small" />
			</Tool>
			<Tool label="Inline code" keys="`code`" on={active.code} run={() => chain().toggleCode().run()}>
				<Code fontSize="small" />
			</Tool>
			<Tool
				label={active.link ? "Remove link" : "Link"}
				keys={active.link ? undefined : `${mod}K`}
				on={active.link}
				buttonRef={linkButton}
				run={(target) => (active.link ? chain().extendMarkRange("link").unsetLink().run() : setLinkAnchor(target))}
			>
				{active.link ? <LinkOff fontSize="small" /> : <InsertLink fontSize="small" />}
			</Tool>
			<Sep />
			<Tool label="Bulleted list" on={active.bulletList} run={() => chain().toggleBulletList().run()}>
				<FormatListBulleted fontSize="small" />
			</Tool>
			<Tool label="Numbered list" on={active.orderedList} run={() => chain().toggleOrderedList().run()}>
				<FormatListNumbered fontSize="small" />
			</Tool>
			<Tool label="Quote" on={active.blockquote} run={() => chain().toggleBlockquote().run()}>
				<FormatQuote fontSize="small" />
			</Tool>
			<Tool label="Code block" keys="```" on={active.codeBlock} run={() => chain().toggleCodeBlock().run()}>
				<DataObject fontSize="small" />
			</Tool>
			<Tool label="Divider" run={() => chain().setHorizontalRule().run()}>
				<HorizontalRule fontSize="small" />
			</Tool>
			<Sep />
			<Tool label="Image" run={onInsertImage}>
				<ImageOutlined fontSize="small" />
			</Tool>
			<LinkPopover editor={editor} anchor={linkAnchor} onClose={() => setLinkAnchor(null)} />
			<LinkShortcut editor={editor} onOpen={() => linkButton.current && setLinkAnchor(linkButton.current)} />
		</Stack>
	);
}

function Sep() {
	return <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />;
}

function Tool({
	label,
	keys,
	on = false,
	disabled = false,
	buttonRef,
	run,
	children,
}: {
	buttonRef?: Ref<HTMLButtonElement>;
	label: string;
	keys?: string;
	on?: boolean;
	disabled?: boolean;
	run: (target: HTMLElement) => void;
	children: ReactNode;
}) {
	return (
		<Tooltip title={keys ? `${label} (${keys})` : label}>
			<span>
				<IconButton
					ref={buttonRef}
					size="small"
					aria-label={label}
					aria-pressed={on}
					disabled={disabled}
					color={on ? "primary" : "default"}
					onMouseDown={(e) => e.preventDefault()}
					onClick={(e) => run(e.currentTarget)}
					sx={{ borderRadius: 1.5, bgcolor: on ? "action.selected" : undefined }}
				>
					{children}
				</IconButton>
			</span>
		</Tooltip>
	);
}

/** ⌘K opens the link box from the keyboard; it anchors on the toolbar's link button. */
function LinkShortcut({ editor, onOpen }: { editor: Editor; onOpen: () => void }) {
	useEffect(() => {
		const dom = editor.view.dom;
		function onKeyDown(e: KeyboardEvent) {
			if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "k") return;
			e.preventDefault();
			if (editor.isActive("link")) editor.chain().focus().extendMarkRange("link").unsetLink().run();
			else onOpen();
		}
		dom.addEventListener("keydown", onKeyDown);
		return () => dom.removeEventListener("keydown", onKeyDown);
	}, [editor, onOpen]);
	return null;
}

function LinkPopover({ editor, anchor, onClose }: { editor: Editor; anchor: HTMLElement | null; onClose: () => void }) {
	const [href, setHref] = useState("");
	useEffect(() => {
		if (anchor) setHref("");
	}, [anchor]);
	return (
		<Popover
			open={!!anchor}
			anchorEl={anchor}
			onClose={onClose}
			anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
			slotProps={{ paper: { sx: { p: 1.5, width: 360 } } }}
		>
			<Stack
				component="form"
				direction="row"
				spacing={1}
				onSubmit={(e) => {
					e.preventDefault();
					const address = href.trim();
					if (address) {
						const full = /^(https?:|mailto:|\/|#)/i.test(address) ? address : `https://${address}`;
						const chain = editor.chain().focus().extendMarkRange("link");
						if (editor.state.selection.empty && !editor.isActive("link")) {
							chain.insertContent({ type: "text", text: address, marks: [{ type: "link", attrs: { href: full } }] }).run();
						} else {
							chain.setLink({ href: full }).run();
						}
					}
					onClose();
				}}
			>
				<TextField
					autoFocus
					fullWidth
					size="small"
					placeholder="Paste or type a link"
					value={href}
					onChange={(e) => setHref(e.target.value)}
					slotProps={{ htmlInput: { "aria-label": "Link address" } }}
				/>
				<Button type="submit" variant="contained" size="small">
					Add
				</Button>
			</Stack>
		</Popover>
	);
}

const SIZE_LABELS: Record<ImageSize, string> = { "": "Normal", wide: "Wide", half: "Half", inline: "Inline" };

/** Alt text, size and caption for the selected image, stored the way PostRenderer.bx reads them. */
function ImageSettings({ editor }: { editor: Editor }) {
	const image = useEditorState({
		editor,
		selector: ({ editor }) => {
			const { alt, title } = editor.getAttributes("image");
			return { at: editor.state.selection.from, alt: String(alt ?? ""), title: String(title ?? "") };
		},
	});
	return <ImageFields key={image.at} editor={editor} alt={image.alt} title={image.title} />;
}

// The fields keep their own text while typing: the stored title is trimmed
// when it's read back, which would swallow a space typed at the end.
function ImageFields({ editor, alt: storedAlt, title }: { editor: Editor; alt: string; title: string }) {
	const parsed = parseImageTitle(title);
	const [alt, setAlt] = useState(storedAlt);
	const [size, setSize] = useState<ImageSize>(parsed.size);
	const [caption, setCaption] = useState(parsed.caption);
	const set = (patch: Record<string, string | null>) => editor.chain().updateAttributes("image", patch).run();
	const setTitle = (nextSize: ImageSize, nextCaption: string) => {
		setSize(nextSize);
		setCaption(nextCaption);
		set({ title: composeImageTitle(nextSize, nextCaption) || null });
	};

	return (
		<Paper elevation={8} sx={{ p: 1.5, width: 340, display: "flex", flexDirection: "column", gap: 1.25 }} onMouseDown={(e) => e.stopPropagation()}>
			<ToggleButtonGroup
				size="small"
				exclusive
				fullWidth
				value={size}
				onChange={(_e, next: ImageSize | null) => next !== null && setTitle(next, caption)}
				aria-label="Image size"
			>
				{IMAGE_SIZES.map((option) => (
					<ToggleButton key={option || "normal"} value={option} sx={{ textTransform: "none", py: 0.25 }}>
						{SIZE_LABELS[option]}
					</ToggleButton>
				))}
			</ToggleButtonGroup>
			<TextField
				size="small"
				label="Alt text"
				value={alt}
				onChange={(e) => {
					setAlt(e.target.value);
					set({ alt: e.target.value });
				}}
				helperText="Describes the image for screen readers. Shown as the caption when there's no caption."
			/>
			<TextField
				size="small"
				label="Caption"
				value={caption}
				disabled={size === "inline"}
				onChange={(e) => setTitle(size, e.target.value)}
			/>
		</Paper>
	);
}

function codeBlockAtCursor(editor: Editor) {
	const { $from } = editor.state.selection;
	for (let depth = $from.depth; depth > 0; depth--) {
		if ($from.node(depth).type.name !== "codeBlock") continue;
		const dom = editor.view.nodeDOM($from.before(depth));
		if (dom instanceof HTMLElement) return { getBoundingClientRect: () => dom.getBoundingClientRect() };
	}
	return null;
}

function CodeLanguagePicker({ editor }: { editor: Editor }) {
	const stored = useEditorState({ editor, selector: ({ editor }) => String(editor.getAttributes("codeBlock").language ?? "") });
	const shown = pickerLanguage(stored);
	return (
		<select
			className="c-rich-editor__language"
			aria-label="Code language"
			value={shown || (stored ? "__other" : "")}
			onChange={(e) =>
				editor
					.chain()
					.focus()
					.updateAttributes("codeBlock", { language: e.target.value || null })
					.run()
			}
		>
			<option value="">Plain text</option>
			{stored && !shown && <option value="__other" disabled>{stored}</option>}
			{LANGUAGES.map((l) => (
				<option key={l.id} value={l.id}>
					{l.label}
				</option>
			))}
		</select>
	);
}
