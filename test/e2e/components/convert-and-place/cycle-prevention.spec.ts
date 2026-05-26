import { test, expect } from '../../fixtures/app';
import {
  dragComponentToCanvas,
} from '../../fixtures/components';
import { measureFrame, frameToClient } from '../../fixtures/canvas';
import {
  componentSidebarItem,
  canvasFrame,
  pageRoot,
} from '../../fixtures/selectors';
import { waitForSaved } from '../../fixtures/assertions';

const BUTTON_TSX = `import styles from './Button.module.css';

export default function Button() {
  return (
    <div data-scamp-id="root" className={styles.root}>
    </div>
  );
}
`;

test.use({
  projectOptions: {
    format: 'nextjs',
    components: [{ name: 'Button', tsxContent: BUTTON_TSX }],
  },
});

test.describe('components: cycle prevention at drop', () => {
  test('refuses to drop Button into its own editor (direct self-cycle)', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();

    // Open Button in the editor.
    await componentSidebarItem(window, 'Button').click();
    await expect(canvasFrame(window)).toBeVisible();

    // Drop Button onto its own canvas.
    const metrics = await measureFrame(window);
    const drop = frameToClient(metrics, { x: 150, y: 150 });
    await dragComponentToCanvas(window, 'Button', drop.x, drop.y);

    // No instance lands. The on-disk Button file should NOT contain a
    // self-referencing <Button instance.
    await waitForSaved(window).catch(() => undefined);
    const { tsx } = await project.readComponent('Button');
    expect(tsx).not.toMatch(/<Button[^/]*data-scamp-instance-id/);
    // Self-import never gets written.
    expect(tsx).not.toContain(
      "import Button from '@/components/Button/Button';"
    );
  });
});
