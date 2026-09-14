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
export const SCAMP_READY_RE = /^scamp dev ready http:\/\/127\.0\.0\.1:(\d+)$/m;
export const detectScampReady = (buffer) => {
    const match = SCAMP_READY_RE.exec(buffer);
    const port = match?.[1];
    return port === undefined ? null : Number(port);
};
export const detectReady = (buffer) => {
    // Match either form. The Local URL form is robust against
    // version-specific phrasing ("Ready", "started server on", etc.).
    if (/✓\s*Ready\s+in/i.test(buffer))
        return true;
    if (/(?:^|\n)\s*[-▲►]?\s*Local:\s*https?:\/\/localhost:\d+/i.test(buffer))
        return true;
    return false;
};
