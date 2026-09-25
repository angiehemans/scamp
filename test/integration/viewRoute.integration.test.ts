import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { createComponent, deleteComponent } from '../../src/main/ipc/componentOps';

/**
 * A new view has to get a URL, and the two project formats serve pages
 * from different places.
 *
 * This wrote only Next.js's `app/<slug>/page.tsx`, so in a
 * Scamp-framework project — which routes from `routes/` — an imported
 * view had no URL at all. The preview loaded the home page and every
 * link or page-picker jump after it was a 404 and a blank white screen.
 */

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'scamp-route-'));
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

const make = (name: string, format: 'scamp' | 'nextjs') =>
  createComponent(
    {
      projectPath: dir,
      componentName: name,
      kind: 'view',
      wrapperSlug: name.toLowerCase(),
      tsxContent: 'export default function X() { return null; }\n',
      cssContent: '.root {}\n',
    } as never,
    format
  );

const read = async (file: string): Promise<string | null> => {
  try {
    return await fs.readFile(path.join(dir, file), 'utf-8');
  } catch {
    return null;
  }
};

describe('a new view gets a URL in the format the project actually serves', () => {
  it('writes a route for a Scamp-framework project', async () => {
    await make('Lobby', 'scamp');
    const route = await read('routes/lobby.tsx');
    expect(route).not.toBeNull();
    expect(route).toContain("import Lobby from '@/views/Lobby/Lobby'");
    expect(route).toContain('<Lobby />');
  });

  it('declares a render mode, which the framework requires', async () => {
    await make('Lobby', 'scamp');
    expect(await read('routes/lobby.tsx')).toContain("export const render = 'static'");
  });

  it('does not leave a Next.js wrapper in a framework project', async () => {
    await make('Lobby', 'scamp');
    expect(await read('app/lobby/page.tsx')).toBeNull();
  });

  it('still writes the wrapper for a Next.js project', async () => {
    await make('Lobby', 'nextjs');
    expect(await read('app/lobby/page.tsx')).not.toBeNull();
    expect(await read('routes/lobby.tsx')).toBeNull();
  });

  it('leaves an existing route alone rather than overwriting it', async () => {
    // The route is the user's file. A second import at the same slug
    // must not quietly replace what they wrote there.
    await make('Lobby', 'scamp');
    await fs.writeFile(
      path.join(dir, 'routes', 'lobby.tsx'),
      "// hand written\n",
      'utf-8'
    );
    await fs.rm(path.join(dir, 'views', 'Lobby'), { recursive: true, force: true });
    await make('Lobby', 'scamp');
    expect(await read('routes/lobby.tsx')).toContain('hand written');
  });

  it('routes the home view at the index, not at /home', async () => {
    await make('Home', 'scamp');
    expect(await read('routes/index.tsx')).not.toBeNull();
    expect(await read('routes/home.tsx')).toBeNull();
  });

});
