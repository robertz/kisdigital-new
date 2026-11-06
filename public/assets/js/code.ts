import { hljs, languageLabel } from "../../../manage-app/src/shared/code";

/**
 * Post pages: highlights each code block with the grammars the post editor
 * uses, and gives it a header with its language and a Copy button. Loaded
 * only on posts that have a code fence (routes/Posts.bx hasCodeBlocks).
 */
function decorate(pre: HTMLPreElement) {
	const code = pre.querySelector(":scope > code");
	if (!code || pre.querySelector(":scope > .c-code-head")) return;

	const language = (/(?:^|\s)language-([\w+#-]+)/i.exec(code.className)?.[1] ?? "").toLowerCase();
	if (language && hljs.getLanguage(language)) hljs.highlightElement(code as HTMLElement);

	const head = document.createElement("div");
	head.className = "c-code-head";
	const label = document.createElement("span");
	label.textContent = (language && languageLabel(language)) || "Code";
	const copy = document.createElement("button");
	copy.type = "button";
	copy.className = "c-code-copy";
	copy.textContent = "Copy";
	copy.setAttribute("aria-label", `Copy ${label.textContent} code`);
	copy.addEventListener("click", () => {
		navigator.clipboard.writeText(code.textContent ?? "").then(
			() => flash(copy, "Copied"),
			() => flash(copy, "Couldn't copy"),
		);
	});
	head.append(label, copy);
	pre.prepend(head);
}

function flash(button: HTMLButtonElement, text: string) {
	button.textContent = text;
	window.setTimeout(() => (button.textContent = "Copy"), 1500);
}

document.querySelectorAll<HTMLPreElement>(".c-post__body pre").forEach(decorate);
