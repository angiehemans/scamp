/**
 * Turn captured SVG markup into markup React will accept.
 *
 * `svgSource` is the DOM's own serialisation of an icon's innards, and
 * it is emitted into a `.tsx` file verbatim. The DOM writes HTML:
 * `style` is a string, and presentation attributes keep their hyphens.
 * React takes neither. The result was icons that rendered black —
 * `style="fill: currentcolor"` was captured correctly and then thrown
 * away by the renderer — and files React refused outright.
 *
 * Converting here rather than in the generator keeps it to imported
 * markup: a hand-written `<svg>` already contains JSX and must be
 * emitted byte-for-byte, which is the contract `svgSource` promises.
 * see docs/notes/import-svg-jsx.md
 */
/** `stroke-width` → `strokeWidth`; `data-x` and `aria-x` keep their hyphens. */
export declare const jsxAttributeName: (name: string) => string;
/** `fill: none; stroke-width: 2` → `{fill: 'none', strokeWidth: '2'}` source. */
export declare const jsxStyleObject: (declarations: string) => string;
/**
 * Convert a run of captured SVG markup to JSX.
 *
 * Idempotent: markup that is already JSX comes back unchanged, which
 * matters because the source round-trips through `parseCode` and is
 * converted again on every save.
 */
export declare const svgSourceToJsx: (source: string) => string;
