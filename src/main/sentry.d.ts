/**
 * Register (or clear, with `null`) the project root to strip from Sentry
 * events. Stored resolved so it matches the absolute paths in stack
 * frames and breadcrumbs.
 */
export declare const setSentryProjectRoot: (root: string | null) => void;
/**
 * Replace every occurrence of `root` in `s` with `<project>`. Literal
 * (not regex) match so path characters need no escaping. Pure — exported
 * for tests.
 */
export declare const scrubRoot: (s: string, root: string | null) => string;
/**
 * Sentry crash-reporting init for Scamp's main process.
 *
 * The user's opt-in choice lives in `settings.json` (the same
 * file as the default-projects-folder preference). On startup
 * `src/main/index.ts` reads it synchronously and calls
 * `initSentryIfOptedIn` BEFORE anything else can throw — so a
 * crash during the rest of init is still captured.
 *
 * The renderer's Privacy toggle in Settings flips the value
 * mid-session; an IPC channel re-runs this init (when
 * toggled on) or `closeSentry` (when toggled off) so the
 * change takes effect immediately without restart.
 */
/**
 * Scrub absolute paths from a string. Same regexes used by the
 * `beforeSend` hook and the renderer init. Exported for tests.
 */
export declare const scrubPaths: (s: string | undefined) => string | undefined;
/**
 * Initialise the Sentry SDK. Called once at module-load time from
 * `src/main/index.ts`, BEFORE `app.whenReady()` — Sentry's
 * Electron SDK hooks into protocol / IPC during init and that
 * has to happen before Electron locks those layers down at the
 * 'ready' event.
 *
 * `optedIn === true` enables transmission; `false` (or `null` from
 * a fresh install with no decision yet) initialises the SDK but
 * leaves `enabled: false` so events are captured locally and
 * dropped rather than sent. The user's opt-in flips
 * `enabled` at runtime via `setSentryEnabled` below.
 *
 * No-ops cleanly when the DSN env var is missing — typical dev
 * setup without a key. The first-launch prompt and Settings
 * toggle both still work; toggle changes just have no
 * transmission target.
 */
export declare const initSentryIfOptedIn: (optedIn: boolean) => void;
/**
 * Flip the transmission gate at runtime — used when the user
 * toggles the Privacy switch in Settings or answers the
 * first-launch opt-in prompt. The SDK is already running from
 * the module-load init; this just enables or disables
 * transmission going forward.
 *
 * No-op when the SDK never initialised (missing DSN, init
 * exception). Safe to call any number of times.
 */
export declare const setSentryEnabled: (enabled: boolean) => void;
/**
 * Tear down Sentry. Used by the test suite — production paths
 * use `setSentryEnabled(false)` to gate transmission instead.
 * Calling `Sentry.close()` and trying to re-init from scratch
 * mid-session would hit the pre-ready check and fail.
 *
 * Returns a promise so callers can await the flush.
 */
export declare const closeSentry: () => Promise<void>;
/**
 * True when Sentry is currently running. Exposed for tests and
 * for diagnostic UI.
 */
export declare const isSentryInitialised: () => boolean;
