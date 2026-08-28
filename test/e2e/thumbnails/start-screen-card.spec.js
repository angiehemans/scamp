import { promises as fs } from 'fs';
import * as path from 'path';
import { test, expect } from '../fixtures/app';
import { canvasElement, pageRoot } from '../fixtures/selectors';
import { dragInFrame, selectTool } from '../fixtures/canvas';
import { waitForSaved } from '../fixtures/assertions';
/**
 * The other end of the thumbnail feature: the start-screen card that reads
 * `.scamp/preview.png` back and renders it.
 *
 * `ProjectCardThumb` has no unit coverage — vitest runs in a node
 * environment here, and pulling in a DOM implementation for one component
 * is a dependency for something this can test directly.
 *
 * The two states are the whole component: an image when the project has
 * one, and a same-height placeholder when it does not, so the card grid
 * stays even either way.
 *
 * see docs/notes/project-thumbnails.md
 */
const HOME_TSX = `import styles from './page.module.css';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="rect_swatch" className={styles.rect_swatch}></div>
    </div>
  );
}
`;
const HOME_CSS = `.root {
  background-color: rgb(255, 255, 255);
}

.rect_swatch {
  position: absolute;
  left: 0px;
  top: 0px;
  width: 1440px;
  height: 500px;
  background-color: rgb(0, 128, 255);
}
`;
test.use({
    projectOptions: {
        format: 'nextjs',
        pageContent: { home: { tsx: HOME_TSX, css: HOME_CSS } },
    },
});
/**
 * A fresh userData dir has no default projects folder, so the start screen
 * renders its first-run welcome state and there are no cards at all. Point
 * it at the temp root holding this project — one project, one card.
 */
const useProjectsFolder = async (window, dir) => {
    await window.evaluate((folder) => globalThis.scamp.setDefaultProjectsFolder(folder), dir);
};
/** The fixture boots into a project; step back out to the start screen. */
const toStartScreen = async (window, projectDir) => {
    await useProjectsFolder(window, path.dirname(projectDir));
    await window.getByRole('button', { name: '← Projects' }).click();
    await expect(window.getByTestId('account-panel')).toBeVisible();
};
const cardThumb = (window) => window.getByTestId('project-card-thumb').first();
test.describe('start screen: project card thumbnail', () => {
    test('renders the captured image once the project has one', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await expect(canvasElement(window, 'rect_swatch')).toBeVisible();
        // A home-page save schedules the capture; closing flushes it.
        await selectTool(window, 'r');
        await dragInFrame(window, { x: 200, y: 600 }, { x: 260, y: 660 });
        await waitForSaved(window);
        await expect
            .poll(async () => (await fs
            .stat(path.join(project.dir, '.scamp', 'preview.png'))
            .catch(() => null)) !== null, { timeout: 20_000, message: 'thumbnail was never written' })
            .toBe(true);
        await toStartScreen(window, project.dir);
        const image = cardThumb(window).locator('img');
        await expect(image).toBeVisible();
        // Base64 through IPC rather than a file:// src — the established
        // pattern here, and it sidesteps CSP entirely.
        expect(await image.getAttribute('src')).toMatch(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/);
        // It decoded: a broken src still yields a visible <img> box.
        const decoded = await image.evaluate((el) => el.naturalWidth);
        expect(decoded).toBeGreaterThan(0);
    });
    test('reserves the same space when the project has no thumbnail', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        // Leave without editing, so nothing was ever captured.
        await toStartScreen(window, project.dir);
        expect(await fs
            .stat(path.join(project.dir, '.scamp', 'preview.png'))
            .catch(() => null)).toBeNull();
        const thumb = cardThumb(window);
        await expect(thumb).toBeVisible();
        await expect(thumb.locator('img')).toHaveCount(0);
        // The placeholder keeps the card's height, or the grid goes ragged
        // the moment one project has a thumbnail and another does not.
        const height = await thumb.evaluate((el) => el.getBoundingClientRect().height);
        expect(height).toBeGreaterThan(0);
    });
});
