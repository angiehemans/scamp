/**
 * The canonical blank Scamp component — folder name rules plus the
 * starter TSX + CSS. Pure so the MCP `scamp_get_component_scaffold`
 * tool and the `component:create` IPC hand out byte-identical files.
 */
/**
 * Folder + binding identifier for a Scamp component. Must be
 * PascalCase: the folder name, the TSX filename, the React
 * function name, AND every page's `import` binding all share
 * this string, so it has to be a valid JSX identifier. Disallow
 * underscores and hyphens — they would break Capitalised-tag
 * detection in the parser.
 */
export declare const COMPONENT_NAME_RE: RegExp;
export declare const defaultComponentTsx: (componentName: string) => string;
export declare const DEFAULT_COMPONENT_CSS = ".root {\n  width: 100%;\n  position: relative;\n}\n";
/** Project-relative paths for a component, POSIX, for agent-facing output. */
export declare const componentRelativePaths: (componentName: string) => {
    tsx: string;
    css: string;
};
