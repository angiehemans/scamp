/**
 * Locates the selected element inside the code panel's TSX and CSS, so
 * selecting a rectangle on canvas shows you the code that produces it.
 *
 * Works on TEXT, not on a parsed tree, because the panel shows what is on
 * disk — which an agent or editor may have reformatted since Scamp wrote it.
 * Anchoring on the `data-scamp-id` attribute and on brace matching survives
 * reformatting; anchoring on generated indentation would not.
 * see docs/notes/code-highlight.md
 */
/** Inclusive, 1-BASED line numbers — CodeMirror numbers lines from 1. */
export type LineRange = {
    from: number;
    to: number;
};
/**
 * Lines whose opening tag identifies this element.
 *
 * Both attributes are checked: ordinary elements carry `data-scamp-id`,
 * component instances carry `data-scamp-instance-id` (they own no CSS class,
 * so the CSS side will correctly find nothing for them).
 *
 * The value is matched in full, between the quotes — a substring match would
 * make `rect_a1` highlight `rect_a1b2`.
 */
export declare const findTsxLines: (tsx: string, className: string) => LineRange[];
/**
 * Rule blocks whose selector targets the class — the base rule, any state
 * variants, and the copies nested inside `@media` blocks.
 *
 * Only the inner rule is returned for a media query, never the whole `@media`
 * wrapper: highlighting the wrapper would light up every unrelated element
 * that happens to share the breakpoint.
 */
export declare const findCssBlocks: (css: string, className: string) => LineRange[];
/** First line to reveal, or null when the element isn't in this source. */
export declare const firstLine: (ranges: ReadonlyArray<LineRange>) => number | null;
