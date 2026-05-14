import { resolve } from 'path';
import { defineConfig, loadEnv } from 'electron-vite';
import react from '@vitejs/plugin-react';
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
            plugins: [react()],
        },
    };
});
