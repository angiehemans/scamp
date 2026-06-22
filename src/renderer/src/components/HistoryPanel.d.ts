type Props = {
    /** Active project root — snapshots are scoped to it. */
    projectPath: string;
};
/**
 * The History panel — the second tab in the left sidebar. Shows a unified,
 * newest-first timeline (with a "Now" marker) that interleaves the
 * project's durable on-disk snapshots with the active page's in-memory
 * undo entries, so users get per-edit granularity between the coarser
 * snapshots without extra disk writes. Clicking a snapshot restores it
 * from disk (after confirming); clicking an undo entry jumps the canvas to
 * that point in-session (current page, no disk write). "Save snapshot"
 * takes a manual one. See docs/notes/snapshots.md.
 */
export declare const HistoryPanel: ({ projectPath }: Props) => JSX.Element;
export {};
