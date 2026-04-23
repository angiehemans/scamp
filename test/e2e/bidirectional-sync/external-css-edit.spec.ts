import { promises as fs } from 'fs';
import * as path from 'path';

import { test, expect } from '../fixtures/app';
import { dragInFrame, selectTool } from '../fixtures/canvas';
import {
  canvasElement,
  canvasElementsByPrefix,
  pageRoot,
} from '../fixtures/selectors';
import { waitForSaved } from '../fixtures/assertions';

/**
 * Simulates an external editor (VS Code, an AI agent, sed) rewriting
 * the CSS module on disk. Chokidar picks up the change, the renderer
 * re-parses, and the canvas reflects it.
 */
test.describe('bidirectional sync: external CSS edit', () => {
  test('rewriting a class block on disk updates the canvas element', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();

    // Draw a rect so we have something to mutate. 140×120 drawn at (100,100).
    await selectTool(window, 'r');
    await dragInFrame(window, { x: 100, y: 100 }, { x: 240, y: 220 });
    const rect = canvasElementsByPrefix(window, 'rect_').first();
    const className = await rect.getAttribute('data-scamp-id');
    if (!className) throw new Error('no rect created');
    await waitForSaved(window);

    // Rewrite just the rect's class block to widen it to 480 px.
    const cssPath = path.join(project.dir, 'home.module.css');
    const original = await fs.readFile(cssPath, 'utf-8');
    const widened = original.replace(
      /width:\s*140px/,
      'width: 480px'
    );
    expect(widened).not.toBe(original);
    await fs.writeFile(cssPath, widened, 'utf-8');

    // The canvas should pick up the new width via the watcher.
    await expect
      .poll(async () => {
        const box = await canvasElement(window, className).boundingBox();
        return box ? Math.round(box.width) : 0;
      }, { timeout: 10_000 })
      .toBeGreaterThanOrEqual(470);
  });
});
