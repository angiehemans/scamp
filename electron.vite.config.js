import { resolve } from 'path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    main: {
        build: {
            rollupOptions: {
                external: ['chokidar', 'postcss', 'node-pty'],
            },
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
        // Two preloads, one per window: the main app's preload and a
        // smaller preview-window preload that exposes only the
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
});
