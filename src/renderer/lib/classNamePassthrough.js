/**
 * A generated component forwards an optional `className` prop onto its root
 * element, so a page can size an instance without the component knowing
 * anything about that page. see docs/notes/components-data-model.md
 *
 * The generator and the parser share the pattern from here so the two can't
 * drift: `generateTsx` writes the attribute, `parseTsxStructure` normalises
 * it away before the HTML parser runs.
 */
/**
 * The `className` attribute value a component's ROOT element carries.
 *
 * A template literal is the only shape that can join two class names, and
 * it necessarily contains a space — which the TSX parser (an HTML parser)
 * would read as the end of an unquoted attribute value. That's why the
 * parser normalises it away rather than trying to read it.
 */
export const rootClassNameAttribute = (cssClass) => `className={\`\${styles.${cssClass}} \${className ?? ''}\`}`;
/** The prop name components accept and forward. */
export const PASSTHROUGH_PROP = 'className';
const PASSTHROUGH_RE = /className=\{`\$\{styles\.([A-Za-z_][A-Za-z0-9_]*)\}\s+\$\{\s*className\s*\?\?\s*(?:''|"")\s*\}`\}/g;
/**
 * Rewrite the root passthrough attribute back to the plain
 * `className={styles.X}` form the structure parser understands. Runs before
 * the HTML parse; files without the pattern (pages, and components written
 * before the passthrough existed) come through untouched.
 */
export const normalizeRootClassNamePassthrough = (tsx) => tsx.replace(PASSTHROUGH_RE, 'className={styles.$1}');
