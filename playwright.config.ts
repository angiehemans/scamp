import { defineConfig } from '@playwright/test';

/**
 * Playwright drives the built Electron app directly — there's no browser
 * project here. Every spec launches its own Electron instance via the
 * fixture in `test/e2e/fixtures/app.ts`.
 *
 * Always `npm run build` before running: Playwright loads
 * `out/main/index.js` and `out/renderer/index.html` produced by
 * `electron-vite build`, not the dev server.
 */
export default defineConfig({
  testDir: './test/e2e',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  // Electron apps share a lot of global state (userData dir, installed
  // protocols). Running specs in parallel risks port/file contention.
  fullyParallel: false,
  workers: 1,
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI']
    ? [['list'], ['html', { open: 'always' }]]
    : [['list'], ['html', { open: 'on-failure' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
