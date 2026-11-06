import type { HLJSApi, Language, LanguageFn } from "highlight.js";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import plaintext from "highlight.js/lib/languages/plaintext";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import hljs from "highlight.js/lib/core";

/**
 * Code highlighting shared by the post editor (through lowlight) and
 * published posts (public/assets/js/code.js), so a block looks the same in
 * both. highlight.js has no BoxLang or CFML grammar: JavaScript's rules plus
 * the keywords and scopes BoxLang adds read well enough.
 */
const boxlang: LanguageFn = (api: HLJSApi): Language => {
	const js = javascript(api);
	const keywords = js.keywords as Record<string, string[] | string>;
	const list = (name: string) => (Array.isArray(keywords[name]) ? (keywords[name] as string[]) : []);
	return {
		...js,
		name: "BoxLang",
		aliases: ["bx", "bxs", "bxm", "cfml", "cfc", "cfm", "cfscript"],
		case_insensitive: true,
		keywords: {
			...keywords,
			keyword: [
				...list("keyword"),
				...["component", "property", "interface", "abstract", "final", "public", "private", "remote", "package", "required", "default"],
				...["transaction", "lock", "thread", "include", "param", "rethrow", "abort", "savecontent", "output", "queryparam"],
			],
			type: ["any", "array", "binary", "boolean", "date", "function", "numeric", "query", "string", "struct", "void", "xml"],
			built_in: [...list("built_in"), "variables", "arguments", "local", "request", "session", "application", "server", "cgi", "form", "url", "cookie"],
		},
	};
};

export const LANGUAGES: { id: string; label: string }[] = [
	{ id: "boxlang", label: "BoxLang / CFML" },
	{ id: "js", label: "JavaScript" },
	{ id: "typescript", label: "TypeScript" },
	{ id: "html", label: "HTML / XML" },
	{ id: "css", label: "CSS" },
	{ id: "sql", label: "SQL" },
	{ id: "java", label: "Java" },
	{ id: "json", label: "JSON" },
	{ id: "yaml", label: "YAML" },
	{ id: "bash", label: "Shell" },
	{ id: "md", label: "Markdown" },
	{ id: "python", label: "Python" },
	{ id: "dockerfile", label: "Dockerfile" },
	{ id: "diff", label: "Diff" },
];

export const GRAMMARS: Record<string, LanguageFn> = {
	boxlang,
	javascript,
	typescript,
	xml,
	css,
	sql,
	java,
	json,
	yaml,
	bash,
	markdown,
	python,
	dockerfile,
	diff,
	plaintext,
};

for (const [name, grammar] of Object.entries(GRAMMARS)) hljs.registerLanguage(name, grammar);
hljs.configure({ ignoreUnescapedHTML: true });

export { hljs };

function grammarOf(name: string): string {
	const language = hljs.getLanguage(name);
	if (!language) return "";
	return Object.keys(GRAMMARS).find((key) => hljs.getLanguage(key) === language) ?? "";
}

/**
 * The picker's entry for whatever follows ``` in a post: "javascript" shows
 * as JavaScript even though the picker writes "js". The stored name is only
 * changed when someone picks a different language.
 */
export function pickerLanguage(name: string): string {
	const wanted = name.toLowerCase();
	if (!wanted) return "";
	if (LANGUAGES.some((l) => l.id === wanted)) return wanted;
	const grammar = grammarOf(wanted);
	return grammar ? (LANGUAGES.find((l) => grammarOf(l.id) === grammar)?.id ?? "") : "";
}

/** What a block's header calls its language: "js" and "javascript" both read JavaScript. */
export function languageLabel(name: string): string {
	const picked = pickerLanguage(name);
	if (picked) return LANGUAGES.find((l) => l.id === picked)!.label;
	return hljs.getLanguage(name)?.name ?? "";
}
