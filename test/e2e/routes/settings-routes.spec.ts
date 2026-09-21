import { promises as fs } from 'fs';
import * as path from 'path';

import { test, expect } from '../fixtures/app';
import { pageRoot } from '../fixtures/selectors';

/**
 * The project's whole routing table lives in Project Settings. The
 * properties panel shows the open page's route on its own, so this is
 * where a route that belongs to another page — or to no page, like an
 * API handler — is visible. see docs/notes/routes-in-the-app.md
 */

const WATCHER_TIMEOUT = 30_000;

test.describe('routes in project settings', () => {
  test.use({ projectOptions: { format: 'scamp' } });

  test('lists every route, including API handlers, and sets a render mode', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();

    await fs.mkdir(path.join(project.dir, 'routes', 'api'), { recursive: true });
    await fs.writeFile(
      path.join(project.dir, 'routes', 'api', 'ping.ts'),
      "export const GET = () => new Response('pong');\n",
      'utf-8'
    );

    await window.locator('[data-section="settings"]').click();
    const section = window.getByTestId('settings-routes');
    await expect(section).toBeVisible();

    // The page route the template ships with, and the API route that
    // the sidebar's page-scoped list never shows.
    await expect(section.getByTestId('route-index.tsx')).toContainText('/');
    await expect(section.getByTestId('route-api/ping.ts')).toContainText('/api/ping', {
      timeout: WATCHER_TIMEOUT,
    });

    // The render control works here too, and writes the export.
    const file = path.join(project.dir, 'routes', 'index.tsx');
    await section
      .getByTestId('route-index.tsx')
      .getByRole('button', { name: 'server', exact: true })
      .click();
    await expect
      .poll(async () => (await fs.readFile(file, 'utf-8')).includes("export const render = 'server';"), {
        timeout: 10_000,
      })
      .toBe(true);
  });

  test('opening a route leaves settings and shows it in the code panel', async ({
    window,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await window.locator('[data-section="settings"]').click();

    await window
      .getByTestId('settings-routes')
      .getByTestId('route-index.tsx')
      .getByRole('button', { name: /^\// })
      .click();

    await expect(window.getByRole('heading', { name: 'Project Settings' })).toBeHidden();
    await expect(window.getByTestId('code-panel-route')).toContainText('routes/index.tsx');
  });
});
