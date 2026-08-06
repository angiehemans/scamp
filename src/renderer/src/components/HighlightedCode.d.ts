import { type Extension } from '@codemirror/state';
import type { LineRange } from '@lib/codeHighlight';
/**
 * A read-only CodeMirror pane that highlights the selected element's lines
 * and scrolls them into view.
 *
 * The ranges arrive as data (from `@lib/codeHighlight`) rather than being
 * computed here, so the "which lines" logic stays pure and tested and this
 * file only owns the CodeMirror plumbing.
 */
type Props = {
    value: string;
    language: Extension;
    /** 1-based inclusive line ranges to highlight. Empty = no highlight. */
    ranges: ReadonlyArray<LineRange>;
    theme: Extension;
};
export declare const HighlightedCode: ({ value, language, ranges, theme, }: Props) => JSX.Element;
export {};
