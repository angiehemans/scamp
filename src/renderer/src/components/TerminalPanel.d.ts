type Props = {
    cwd: string;
    /**
     * When true, the panel is hidden via `display: none` rather than
     * unmounted. The pty processes inside each tab keep running so the
     * user can come back to a long-running command (e.g. an agent CLI)
     * without losing the session.
     */
    hidden?: boolean;
};
export declare const TerminalPanel: ({ cwd, hidden }: Props) => JSX.Element;
export {};
