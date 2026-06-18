type Props = {
    /** Active project root — snapshots are scoped to it. */
    projectPath: string;
};
/**
 * The History panel — the second tab in the left sidebar. Lists the
 * project's persistent snapshots (newest first) with a "Now" marker for
 * the current state. Clicking a snapshot restores it (after confirming);
 * "Save snapshot" takes a manual one. The in-session Cmd+Z undo stack is
 * independent and unaffected. See docs/notes/snapshots.md.
 */
export declare const HistoryPanel: ({ projectPath }: Props) => JSX.Element;
export {};
