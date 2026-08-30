import { test, expect } from '../fixtures/app';
import { pageRoot } from '../fixtures/selectors';
import { layersRowByClass } from '../fixtures/layers';
import { waitForSaved } from '../fixtures/assertions';
/**
 * The Image section's Source and Alt fields.
 *
 * `src` and `alt` already round-trip through generateCode/parseCode —
 * including an absolute URL — so the model was never the limit. Source
 * was simply read-only in the panel: the only way to change it was
 * "Replace", which imports a file from the project's assets. That left
 * no route to an image you have not imported.
 */
const PAGE_TSX = `import styles from './home.module.css';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <img data-scamp-id="image_a1b2" className={styles.image_a1b2} src="/assets/original.png" alt="" />
    </div>
  );
}
`;
const PAGE_CSS = `.root {
  width: 1440px;
  height: 900px;
  position: relative;
}

.image_a1b2 {
  width: 200px;
  height: 200px;
  position: absolute;
  left: 40px;
  top: 40px;
  object-fit: cover;
}
`;
test.use({
    projectOptions: {
        format: 'nextjs',
        pageContent: { home: { tsx: PAGE_TSX, css: PAGE_CSS } },
    },
});
test.describe('properties panel: image source and alt', () => {
    test('typing alt text writes it to the TSX intact', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        // Selected from the layers panel: the canvas chrome overlay sits
        // over the element and swallows a direct click.
        await layersRowByClass(window, 'image_a1b2').click();
        const alt = window.getByPlaceholder('Image description');
        await expect(alt).toBeVisible();
        await alt.fill('A tabby cat asleep on a keyboard');
        await alt.press('Enter');
        await waitForSaved(window);
        // The whole string, in order — a per-keystroke save that races the
        // reload would land a truncated or scrambled value.
        await expect
            .poll(async () => project.readTsx(), { timeout: 5_000 })
            .toContain('alt="A tabby cat asleep on a keyboard"');
    });
    test('an absolute URL can be typed into Source', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        // Selected from the layers panel: the canvas chrome overlay sits
        // over the element and swallows a direct click.
        await layersRowByClass(window, 'image_a1b2').click();
        const src = window.getByPlaceholder('Path or URL');
        await expect(src).toBeVisible();
        await src.fill('https://example.com/photo.png');
        await src.press('Enter');
        await waitForSaved(window);
        await expect
            .poll(async () => project.readTsx(), { timeout: 5_000 })
            .toContain('src="https://example.com/photo.png"');
    });
    test('a project-relative path can be typed into Source', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        // Selected from the layers panel: the canvas chrome overlay sits
        // over the element and swallows a direct click.
        await layersRowByClass(window, 'image_a1b2').click();
        const src = window.getByPlaceholder('Path or URL');
        await src.fill('/assets/hero-banner.webp');
        await src.press('Enter');
        await waitForSaved(window);
        await expect
            .poll(async () => project.readTsx(), { timeout: 5_000 })
            .toContain('src="/assets/hero-banner.webp"');
    });
});
