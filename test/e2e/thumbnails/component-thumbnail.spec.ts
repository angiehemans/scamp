import { promises as fs } from 'fs';
import * as path from 'path';

import { test, expect } from '../fixtures/app';
import { dragInFrame, selectTool } from '../fixtures/canvas';
import { pageRoot } from '../fixtures/selectors';
import { waitForSaved } from '../fixtures/assertions';

/**
 * The component sidebar thumbnail, which had no coverage at all until the
 * capture underneath it was swapped for the isolated one.
 *
 * The trap this guards is the same one the project thumbnail hit: a blank
 * capture is a perfectly valid PNG of the right dimensions, so "the file
 * exists" passes throughout the bug. The pixels are the assertion.
 *
 * see docs/notes/components-thumbnails.md
 */

const CARD_TSX = `import styles from './Card.module.css';

export default function Card() {
  return <div data-scamp-id="root" className={styles.root}></div>;
}
`;

// A big flat block of colour, nothing like the white a blank capture gives.
const CARD_CSS = `.root {
  width: 400px;
  height: 300px;
  background: rgb(0, 128, 255);
}
`;

test.use({
  projectOptions: {
    format: 'nextjs',
    components: [{ name: 'Card', tsxContent: CARD_TSX, cssContent: CARD_CSS }],
  },
});

test.describe('component sidebar thumbnail', () => {
  test('a component save writes a thumbnail with the component in it', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();

    // Open the component for editing, then make a save inside it.
    await window
      .getByRole('button', { name: /Components/ })
      .click()
      .catch(() => {
        // Rail already on the Components section — nothing to do.
      });
    await window.getByRole('button', { name: 'Card', exact: true }).click();
    await expect(pageRoot(window)).toBeVisible();

    await selectTool(window, 'r');
    await dragInFrame(window, { x: 40, y: 40 }, { x: 160, y: 140 });
    await waitForSaved(window);

    const file = path.join(
      project.dir,
      '.scamp',
      'component-thumbs',
      'Card.png'
    );
    await expect
      .poll(async () => (await fs.stat(file).catch(() => null)) !== null, {
        timeout: 20_000,
        message: 'component thumbnail was never written',
      })
      .toBe(true);

    const png = await fs.readFile(file);
    expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);

    // Decode and look for the component's own colour. A capture that
    // rendered nothing is still a valid PNG of the right size.
    const blue = await window.evaluate(async (base64) => {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = `data:image/png;base64,${base64}`;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx === null) return -1;
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let hits = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (
          Math.abs((data[i] ?? 0) - 0) < 24 &&
          Math.abs((data[i + 1] ?? 0) - 128) < 24 &&
          Math.abs((data[i + 2] ?? 0) - 255) < 24
        ) {
          hits += 1;
        }
      }
      return hits;
    }, png.toString('base64'));
    expect(blue).toBeGreaterThan(1000);
  });
});
