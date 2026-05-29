/**
 * Detect the foreground command running in a pty by inspecting
 * `/proc/<pid>/stat` for the controlling terminal's tpgid.
 *
 * Linux-only — `/proc/<pid>/stat` doesn't exist on macOS or Windows.
 * Phase 4.4 documents the planned macOS implementation
 * (`ps -o tpgid,comm`) and the Windows deferral. For now, callers
 * should check `process.platform === 'linux'` before starting the
 * poller; on other OSes the renderer just gets `processName: null`
 * forever and falls back to the chokidar quiet-window protection.
 *
 * Most of the logic here is in pure helpers so vitest can exercise
 * the parser without needing a real pty or /proc.
 */
/**
 * Parse the contents of `/proc/<pid>/stat` to extract the tpgid
 * (terminal process group id) field.
 *
 * The `stat` format is one line of whitespace-separated fields, but
 * field 2 (`comm`) is wrapped in parentheses and can itself contain
 * spaces / parentheses (e.g. a process named `foo (bar)` would
 * appear as `(foo (bar))`). The standard parser trick is to slice
 * everything before the last `)` (which is the close of comm), then
 * split the remainder on whitespace and pick field 5 (0-indexed) —
 * which is the original field 8 minus the first 3 (pid, comm, state).
 *
 * Returns null if the input doesn't look like a valid `stat` line.
 */
export declare const parseTpgid: (statContent: string) => number | null;
/**
 * Read the basename of a process's executable from
 * `/proc/<pid>/comm`. Returns null if /proc isn't available or the
 * process has already exited.
 */
export declare const readProcessName: (pid: number) => Promise<string | null>;
/**
 * Resolve the pty's foreground command name.
 *
 *   - Reads `/proc/<shellPid>/stat` to find the tpgid.
 *   - Reads `/proc/<tpgid>/comm` for the command name.
 *   - Returns `null` when the foreground process IS the shell
 *     (`tpgid === shellPid`) — the pty is at an idle prompt.
 *   - Returns `null` on any I/O error (process exited, kernel
 *     refused, /proc not mounted, etc.) — defensive default that
 *     means "no agent activity" so we don't pause without reason.
 *
 * `shellBaseName` is used as a defensive cross-check: if the tpgid
 * resolves to the same command name as the shell, we still treat
 * it as idle. Covers the case where the user has spawned a nested
 * shell of the same kind (`bash` inside `bash`), which we don't
 * want to confuse with agent activity.
 */
export declare const readForeground: (shellPid: number, shellBaseName: string) => Promise<string | null>;
/**
 * Normalize a `SHELL` env value (`/bin/zsh`, `/usr/bin/bash`, …)
 * to its basename so callers can compare against `/proc/<pid>/comm`.
 */
export declare const shellBaseName: (shellPath: string) => string;
/**
 * True when this OS supports the `/proc`-based foreground detection.
 * Linux only — macOS will need a different strategy (Phase 4.4).
 */
export declare const supportsForegroundDetection: () => boolean;
