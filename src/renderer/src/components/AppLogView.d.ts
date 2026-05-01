/**
 * Read-only pane that surfaces app-level log entries (currently just
 * save failures). Lives as a tab inside `TerminalPanel` alongside the
 * real pty shells — users expect diagnostic output to live in the
 * terminal area.
 */
export declare const AppLogView: () => JSX.Element;
