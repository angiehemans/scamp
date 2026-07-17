import { test, expect } from '../fixtures/app';
import { dragComponentToCanvas } from '../fixtures/components';
import { selectTool, measureFrame, frameToClient } from '../fixtures/canvas';
import { pageRoot } from '../fixtures/selectors';

// Regression: selecting a component instance on a page must show the blue
// selection border. The instance wrapper is structurally 0-sized (its
// component renders with absolute positioning), so the selection overlay is
// measured from the instance's rendered content bounds and draws the border
// itself. see docs/notes/components-data-model.md

const CARD_TSX = `import styles from './Card.module.css';

export default function Card() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="rect_a" className={styles.rect_a} />
    </div>
  );
}
`;
const CARD_CSS = `.root {
  width: 200px;
  height: 120px;
  background: #f0f0f0;
}

.rect_a {
  width: 200px;
  height: 120px;
  background: #cccccc;
}
`;

test.use({
  projectOptions: {
    format: 'nextjs',
    components: [{ name: 'Card', tsxContent: CARD_TSX, cssContent: CARD_CSS }],
  },
});

test.describe('components: instance selection border', () => {
  test('a placed component instance shows a selection border sized to its content', async ({
    window,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await selectTool(window, 'v');
    const metrics = await measureFrame(window);
    const drop = frameToClient(metrics, { x: 100, y: 100 });
    await dragComponentToCanvas(window, 'Card', drop.x, drop.y);

    // The instance is auto-selected on drop → the overlay renders. With the
    // 0-sized wrapper it collapsed to nothing; now it's sized to the ~200×120
    // content bounds, so it's actually visible.
    const overlay = window.locator('[data-testid="selection-overlay"]');
    await expect(overlay).toBeVisible();
    await expect
      .poll(async () => {
        const box = await overlay.boundingBox();
        return box ? Math.round(Math.min(box.width, box.height)) : 0;
      })
      .toBeGreaterThan(20);
  });
});
