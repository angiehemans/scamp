/**
 * Renderer → main: the user clicked "Restart and install" in the update
 * banner. Quits and relaunches into the freshly-downloaded version.
 * Registered unconditionally — it's a no-op when no update is staged.
 */
export declare const registerUpdaterIpc: () => void;
