/**
 * Bottom code panel: read-only live view of the active page's TSX + CSS.
 *
 * The content is sourced from `pageSource` in the canvas store, which the
 * sync bridge keeps fresh on both canvas-driven writes and external
 * file changes. So whatever's on disk is whatever's in the panel.
 */
export declare const CodePanel: () => JSX.Element;
