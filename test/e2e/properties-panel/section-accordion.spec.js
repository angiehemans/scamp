import { test, expect } from '../fixtures/app';
import { pageRoot } from '../fixtures/selectors';
/**
 * The collapsible sections in the right sidebar: the chevron is part
 * of the header's click target, and Data opens closed with a count so
 * a collapsed section still says whether it holds anything.
 */
const VIEW_TSX = `import styles from './Home.module.css';

type HomeProps = {
  title?: string;
  className?: string;
};

export default function Home({ title = "Hello", className }: HomeProps) {
  return (
    <div data-scamp-id="root" className={\`\${styles.root} \${className ?? ''}\`}>
      <h1 data-scamp-id="text_a1b1" className={styles.text_a1b1}>{title}</h1>
    </div>
  );
}

export const _scamp = { contract: 2, events: [] } as const;
`;
const VIEW_CSS = `.root {
    width: 100%;
    position: relative;
}

.text_a1b1 {
    color: #111111;
    font-size: 24px;
}
`;
test.describe('panel section accordions', () => {
    test.use({
        projectOptions: {
            format: 'scamp',
            pageContent: { home: { tsx: VIEW_TSX, css: VIEW_CSS } },
        },
    });
    test('clicking the chevron toggles the section', async ({ window }) => {
        await expect(pageRoot(window)).toBeVisible();
        const shortcuts = window.getByRole('button', { name: 'Keyboard Shortcuts' });
        await expect(shortcuts).toHaveAttribute('aria-expanded', 'false');
        // Click the chevron's pixels, the way a user does. It passes its
        // clicks through to the header toggle underneath, which is the
        // behaviour this test exists for.
        const chevron = window
            .locator('[data-panel-section="Keyboard Shortcuts"] svg')
            .last();
        const box = await chevron.boundingBox();
        if (!box)
            throw new Error('the chevron has no box');
        const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        await window.mouse.click(centre.x, centre.y);
        await expect(shortcuts).toHaveAttribute('aria-expanded', 'true');
        await window.mouse.click(centre.x, centre.y);
        await expect(shortcuts).toHaveAttribute('aria-expanded', 'false');
    });
    test('Data starts closed and says how many props the view has', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const section = window.getByTestId('view-data-section');
        await expect(section).toBeVisible();
        const toggle = section.getByRole('button', { name: /^Data/ });
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        // Closed means the body isn't rendered at all.
        await expect(section.getByText('Mark a text element as a prop', { exact: false })).toHaveCount(0);
        // The seeded view has one prop, and the header says so.
        await expect(toggle).toHaveAccessibleName('Data, 1');
        await expect(section.getByText('1', { exact: true })).toBeVisible();
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await expect(section.getByText('Mark a text element as a prop', { exact: false })).toBeVisible();
    });
});
