type Props = {
    /** When true, show the project's theme.css instead of the active page. */
    showTheme?: boolean;
};
/**
 * Bottom code panel: read-only live view of the active page's TSX + CSS —
 * or the project's theme.css when the Design System panel is open.
 *
 * Page content is sourced from `pageSource`; theme content from
 * `themeCssRaw`. Both are kept fresh by the sync bridge on canvas-driven
 * writes and external file changes, so what's on disk is what's shown.
 */
export declare const CodePanel: ({ showTheme }: Props) => JSX.Element;
export {};
