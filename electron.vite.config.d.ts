/**
 * Runtime secrets — currently just `SENTRY_DSN` — are baked into
 * the bundled main.js at build time via Vite's `define`
 * substitution. We read them from the project's `.env*` files
 * via Vite's own `loadEnv` (same precedence Vite uses elsewhere:
 * `.env.local` overrides `.env`), so there's a single source of
 * truth in both dev and packaged builds.
 *
 * The alternative (shipping a `.env` inside the asar) is no
 * more secure — asar contents are trivial to extract — and adds
 * runtime file-IO complexity. The Sentry DSN itself isn't a
 * secret in the cryptographic sense: it's a write-only public
 * identifier that anyone with the binary can extract, but they
 * can only submit events, not read them, and Sentry rate-limits
 * by project.
 */
declare const _default: import("electron-vite").ElectronViteConfigFnObject;
export default _default;
