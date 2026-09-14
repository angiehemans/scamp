/**
 * Detect the "dev server is ready" signal in `next dev`'s stdout.
 *
 * Modern Next.js (>=13) prints lines like:
 *
 *   ▲ Next.js 15.0.0
 *   - Local:        http://localhost:3001
 *   - Environments: .env.local
 *   ✓ Ready in 542ms
 *
 * The "Local:" line is the most reliable trigger because it's
 * present across versions; the "Ready" line confirms the server
 * actually started (printed AFTER the listener is up). We accept
 * either.
 *
 * Returns null when the buffer doesn't yet contain a ready signal.
 */
/**
 * `scamp dev` (scampjs contract 1) prints exactly one readiness line on
 * stdout and nothing before it: `scamp dev ready http://127.0.0.1:<port>`.
 * Returns the port it reported, or null until the line arrives.
 */
export declare const SCAMP_READY_RE: RegExp;
export declare const detectScampReady: (buffer: string) => number | null;
export declare const detectReady: (buffer: string) => boolean;
