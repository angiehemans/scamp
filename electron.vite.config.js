import { readFileSync } from 'fs';
import { resolve } from 'path';
import { defineConfig, loadEnv } from 'electron-vite';
import react from '@vitejs/plugin-react';
/**
 * Content-Security-Policy for the MAIN app window. Injected as a
 * `<meta http-equiv>` tag into `index.html` at build time only — never
 * in the dev server, where Vite's HMR relies on an inline react-refresh
 * preamble that `script-src 'self'` would block. The preview window has
 * its own `preview/index.html` and is intentionally left uncovered: it
 * hosts the user's `next dev` app via `<webview>` and must not inherit
 * Scamp's policy.
 *
 * Font origins are exactly the two providers the font picker accepts
 * (see fontEmbed.ts — Google + Adobe; any other URL is rejected):
 *   - Google: `fonts.googleapis.com` (kit CSS) + `fonts.gstatic.com` (woff2)
 *   - Adobe:  `use.typekit.net` (kit CSS, both <link>ed and fetched by
 *     adobeFontsFetch) + `p.typekit.net` (woff2)
 * Plus the `scamp-asset:` image protocol and `data:`/`blob:` for inline
 * and canvas-exported images. `style-src 'unsafe-inline'` is required by
 * CodeMirror and the app's inline element styles. If a third font
 * provider is added to fontEmbed.ts, widen style-src/font-src to match.
 */
const MAIN_WINDOW_CSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://use.typekit.net",
    "font-src 'self' https://fonts.gstatic.com https://use.typekit.net https://p.typekit.net data:",
    "img-src 'self' scamp-asset: data: blob:",
    "connect-src 'self' https://use.typekit.net",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
].join('; ');
/**
 * Inject `MAIN_WINDOW_CSP` into the main window's `index.html` for
 * production builds only. Skipped when the Vite dev server is present
 * (`ctx.server`), and scoped to the top-level `index.html` so the
 * preview shell is left alone.
 */
const injectMainWindowCsp = () => ({
    name: 'scamp-inject-main-window-csp',
    transformIndexHtml: {
        order: 'pre',
        handler(html, ctx) {
            if (ctx.server)
                return html;
            if (ctx.path !== '/index.html')
                return html;
            const tag = `<meta http-equiv="Content-Security-Policy" content="${MAIN_WINDOW_CSP}" />`;
            return html.replace('</title>', `</title>\n    ${tag}`);
        },
    },
});
/**
 * Keep each preload entry self-contained so `webPreferences.sandbox:
 * true` works. The two preloads (`index.ts`, `preview.ts`) both import
 * `@shared/ipcChannels`; by default Rollup hoists that shared module
 * into `out/preload/chunks/*.js`, so the built preload does
 * `require("./chunks/…")`. A sandboxed preload may only
 * `require('electron')` plus a tiny built-in allowlist — a relative
 * chunk require throws on load, `exposeInMainWorld` never runs, and
 * `window.scamp` is undefined (blank screen). See
 * docs/notes/sandbox-tradeoffs.md.
 *
 * This plugin (preload build only) resolves `@shared/ipcChannels` to a
 * unique id per importing entry, so Rollup treats each import as a
 * distinct module and inlines a copy into each preload instead of
 * sharing a chunk. Safe because the module is side-effect-free
 * constants; the duplication is a few hundred bytes per preload.
 */
const inlinePreloadSharedConstants = () => {
    const SHARED = '@shared/ipcChannels';
    const TAG = '?preload-inline=';
    return {
        name: 'scamp-inline-preload-shared-constants',
        enforce: 'pre',
        async resolveId(source, importer, options) {
            // Match both the bare `@shared/ipcChannels` specifier and the
            // absolute path the alias plugin rewrites it to (the alias also
            // runs `enforce: 'pre'`, so either form can reach us first).
            if (importer == null || source.includes(TAG))
                return null;
            const norm = source.replace(/\\/g, '/');
            const isShared = source === SHARED ||
                /(?:^|\/)shared\/ipcChannels(?:\.[cm]?[tj]s)?$/.test(norm);
            if (!isShared)
                return null;
            const resolved = await this.resolve(source, importer, {
                ...options,
                skipSelf: true,
            });
            if (resolved == null)
                return null;
            // Unique id per importing entry → Rollup inlines a copy instead
            // of hoisting a shared chunk.
            return `${resolved.id}${TAG}${encodeURIComponent(importer)}`;
        },
        load(id) {
            const at = id.indexOf(TAG);
            if (at < 0)
                return null;
            return readFileSync(id.slice(0, at), 'utf8');
        },
    };
};
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
export default defineConfig(({ mode }) => {
    // Empty prefix → load every env key, not just `VITE_*`.
    const env = loadEnv(mode, process.cwd(), '');
    return {
        main: {
            build: {
                rollupOptions: {
                    external: ['chokidar', 'postcss', 'node-pty'],
                },
            },
            // String-substitute references to `process.env.SENTRY_DSN`
            // in the bundled main code with the literal value loaded
            // from the .env files above. In packaged builds this is
            // how the DSN reaches runtime; in dev it's the same path.
            define: {
                'process.env.SENTRY_DSN': JSON.stringify(env['SENTRY_DSN'] ?? ''),
            },
            resolve: {
                alias: {
                    '@shared': resolve(__dirname, 'src/shared'),
                },
            },
        },
        preload: {
            // Inline the shared @shared/ipcChannels into each preload entry so
            // the sandboxed main preload has no `require("./chunks/…")`.
            plugins: [inlinePreloadSharedConstants()],
            resolve: {
                alias: {
                    '@shared': resolve(__dirname, 'src/shared'),
                },
            },
            // Two preloads, one per window: the main app's preload and
            // a smaller preview-window preload that exposes only the
            // dev-server lifecycle API.
            build: {
                rollupOptions: {
                    input: {
                        index: resolve(__dirname, 'src/preload/index.ts'),
                        preview: resolve(__dirname, 'src/preload/preview.ts'),
                    },
                },
            },
        },
        renderer: {
            resolve: {
                alias: {
                    '@renderer': resolve(__dirname, 'src/renderer'),
                    '@lib': resolve(__dirname, 'src/renderer/lib'),
                    '@store': resolve(__dirname, 'src/renderer/store'),
                    '@shared': resolve(__dirname, 'src/shared'),
                },
            },
            // Two HTML entry points, one per BrowserWindow:
            //   - `index` (default) is the main app window
            //   - `preview` is the preview window opened by Cmd+P
            // Both entries live INSIDE the renderer source root so
            // electron-vite's renderer build picks them up.
            build: {
                rollupOptions: {
                    input: {
                        index: resolve(__dirname, 'src/renderer/index.html'),
                        preview: resolve(__dirname, 'src/renderer/preview/index.html'),
                    },
                },
            },
            plugins: [react(), injectMainWindowCsp()],
        },
    };
});
