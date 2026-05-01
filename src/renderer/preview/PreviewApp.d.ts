/**
 * Preview window's React shell. Subscribes to dev-server status
 * pushed from main; renders an install/start panel until the
 * server reaches `ready`, then mounts an Electron `<webview>` that
 * loads the live dev-server URL.
 */
export declare const PreviewApp: () => JSX.Element;
