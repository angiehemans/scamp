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
export const COMPONENT_NAME_RE = /^[A-Z][A-Za-z0-9]*$/;
// Must match `generateTsx` byte-for-byte, including the `className`
// passthrough every component accepts — a scaffold that doesn't
// round-trip triggers a canonical-migration write on load.
// see docs/notes/component-scaffold-roundtrip.md
export const defaultComponentTsx = (componentName) => `import styles from './${componentName}.module.css';

type ${componentName}Props = {
  className?: string;
};

export default function ${componentName}({ className }: ${componentName}Props) {
  return (
    <div data-scamp-id="root" className={\`\${styles.root} \${className ?? ''}\`} />
  );
}
`;
// No `min-height: 100vh` here, unlike a page root: a component is
// embedded inside a page, not a full page itself, so a viewport-height
// floor blows out its layout in previews and on live sites. The root
// sizes to its content. see docs/notes/component-min-height-floor.md
export const DEFAULT_COMPONENT_CSS = `.root {
  width: 100%;
  position: relative;
}
`;
/** Project-relative paths for a component, POSIX, for agent-facing output. */
export const componentRelativePaths = (componentName) => ({
    tsx: `components/${componentName}/${componentName}.tsx`,
    css: `components/${componentName}/${componentName}.module.css`,
});
