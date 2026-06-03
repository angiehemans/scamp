/**
 * Merge the login shell's real PATH into process.env.PATH so child
 * spawns (dev server, npm install, terminals) can find node/npm when
 * the app is GUI-launched. No-op on Windows.
 * See docs/notes/packaged-path.md.
 */
export declare const fixPathFromLoginShell: () => void;
