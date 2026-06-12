import { generateCss } from "./css";
import { generateTsx } from "./tsx";
export const generateCode = (args) => {
    return {
        tsx: generateTsx(args.elements, args.rootId, args.pageName, args.cssModuleImportName ?? args.pageName, args.isComponent === true),
        css: generateCss(args.elements, args.rootId, args.breakpoints ?? [], args.customMediaBlocks ?? [], args.pageKeyframesBlocks ?? []),
    };
};
