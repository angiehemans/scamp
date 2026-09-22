import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { test, expect } from '../fixtures/app';
import { componentSidebarItem, pageRoot } from '../fixtures/selectors';
import { layersRowByClass } from '../fixtures/layers';
import { openComponentsSection } from '../fixtures/components';

/**
 * Two things the Image section got wrong away from a plain page.
 *
 * Replace was gated on `activePage`, which the COMPONENT EDITOR leaves
 * null — `loadComponent` sets `activeComponent` and clears it. So the
 * button was enabled and did nothing there. Same family as the CssPanel
 * `editTargetRef` bug in components/css-edits-in-component.spec.ts.
 * (A view opened as a page goes through `loadPage` and was never
 * affected; the existing image specs all run on a page, which is why
 * none of them caught the component case.)
 *
 * And a bound `src` has no literal to show, so the field read as empty
 * with no hint that the value comes from data.
 * see docs/notes/view-bindings.md
 */

const CARD_TSX = `import styles from './Card.module.css';

export default function Card() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <img data-scamp-id="shot_e5f6" className={styles.shot_e5f6} src="/assets/original.png" alt="" />
    </div>
  );
}
`;

const CARD_CSS = `.root {
  width: 240px;
}

.shot_e5f6 {
  width: 200px;
  height: 200px;
}
`;

const VIEW_TSX = `import styles from './Home.module.css';

type HomeProps = {
  shots?: Array<{ id: string; src: string; label: string }>;
  className?: string;
};

export default function Home({
  shots = [
    { id: "1", src: "/assets/one.png", label: "One" },
    { id: "2", src: "/assets/two.png", label: "Two" },
  ],
  className,
}: HomeProps) {
  return (
    <div data-scamp-id="root" className={\`\${styles.root} \${className ?? ''}\`}>
      <img data-scamp-id="plain_a1b2" className={styles.plain_a1b2} src="/assets/original.png" alt="" />
      {shots.map((shot) => (
        <img data-scamp-id="bound_c3d4" className={styles.bound_c3d4} key={shot.id} src={shot.src} alt={shot.label} />
      ))}
    </div>
  );
}

export const _scamp = { contract: 2, events: [] } as const;
`;

const VIEW_CSS = `.root {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.plain_a1b2 {
  width: 200px;
  height: 200px;
}

.bound_c3d4 {
  width: 200px;
  height: 200px;
}
`;

test.use({
  projectOptions: {
    format: 'scamp',
    pageContent: { home: { tsx: VIEW_TSX, css: VIEW_CSS } },
    components: [{ name: 'Card', tsxContent: CARD_TSX, cssContent: CARD_CSS }],
  },
});

test.describe('properties panel: image source away from a plain page', () => {
  test('Replace imports a file in the component editor, where activePage is null', async ({
    app,
    window,
    project,
  }) => {
    // The button was never *disabled* — it was enabled and did nothing,
    // because the handler returned early on state a view never sets. So
    // asserting it's enabled proves nothing; the click has to land.
    // The chooser is a native dialog, stubbed here in the main process.
    // A real 1x1 PNG, because the import actually reads and converts it.
    const picked = path.join(project.dir, 'public', 'assets', 'original.png');
    await mkdir(path.dirname(picked), { recursive: true });
    await writeFile(
      picked,
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64'
      )
    );
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showOpenDialog = async () =>
        ({ canceled: false, filePaths: [filePath] }) as never;
    }, picked);

    await expect(pageRoot(window)).toBeVisible();
    // The component editor is the case that broke: it sets
    // activeComponent and clears activePage.
    await openComponentsSection(window);
    await componentSidebarItem(window, 'Card').click();
    await layersRowByClass(window, 'shot_e5f6').click();

    const src = window.getByPlaceholder('Path or URL');
    await expect(src).toBeVisible();
    await expect(src).toHaveValue('/assets/original.png');

    await window.getByPlaceholder('Image description').fill('before');
    await window.getByPlaceholder('Image description').press('Enter');

    await window.getByRole('button', { name: 'Replace' }).click();

    // The import sets alt from the chosen file's name. Before the fix
    // the handler returned before reaching any of this.
    await expect(window.getByPlaceholder('Image description')).toHaveValue(
      'original.png',
      { timeout: 10_000 }
    );
  });

  test('a bound src shows the binding rather than an empty field', async ({
    window,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await layersRowByClass(window, 'bound_c3d4').click();

    const src = window.getByPlaceholder('Path or URL');
    await expect(src).toBeVisible();
    await expect(src).toHaveValue('shot.src');
    // Read-only: there is no literal behind a row binding to edit, and
    // typing one here would silently contradict the repeat.
    await expect(src).toBeDisabled();
    await expect(window.getByRole('button', { name: 'Replace' })).toBeDisabled();
  });

  test('a bound alt shows its binding too', async ({ window }) => {
    await expect(pageRoot(window)).toBeVisible();
    await layersRowByClass(window, 'bound_c3d4').click();

    const alt = window.getByPlaceholder('Image description');
    await expect(alt).toHaveValue('shot.label');
    await expect(alt).toBeDisabled();
  });
});
