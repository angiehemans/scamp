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
export declare const detectReady: (buffer: string) => boolean;
