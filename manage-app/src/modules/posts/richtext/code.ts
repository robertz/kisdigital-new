import { createLowlight } from "lowlight";
import { GRAMMARS, hljs } from "../../../shared/code";

export { LANGUAGES, pickerLanguage } from "../../../shared/code";

export const lowlight = createLowlight(GRAMMARS);
for (const name of Object.keys(GRAMMARS)) {
	const aliases = hljs.getLanguage(name)?.aliases;
	if (aliases?.length) lowlight.registerAlias(name, aliases);
}
