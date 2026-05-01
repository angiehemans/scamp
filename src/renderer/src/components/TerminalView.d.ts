import '@xterm/xterm/css/xterm.css';
type Props = {
    cwd: string;
    /** Notifies parent when the spawned terminal exits so the tab can be removed. */
    onExit?: (id: string) => void;
};
/**
 * One xterm.js terminal bound to a node-pty process in the main process.
 *
 * Lifecycle:
 *  - On mount: spin up xterm + ask main to spawn a pty in the project cwd.
 *  - User keystrokes → ipc write → pty stdin.
 *  - Pty stdout → ipc data event → xterm.write.
 *  - Container resize → fit addon → ipc resize → pty resize.
 *  - On unmount: kill the pty and dispose xterm.
 */
export declare const TerminalView: ({ cwd, onExit }: Props) => JSX.Element;
export {};
