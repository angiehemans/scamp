import { test, expect } from '../fixtures/app';
import { layersRowByClass } from '../fixtures/layers';
import { pageRoot } from '../fixtures/selectors';

/**
 * The Data tab follows the selection. Selecting a text and opening
 * Data should put its Locked/Prop control in front of you, not a list
 * of every text in the view to find it in.
 */

const VIEW_TSX = `import styles from './Home.module.css';

type HomeProps = {
  className?: string;
};

export default function Home({ className }: HomeProps) {
  return (
    <div data-scamp-id="root" className={\`\${styles.root} \${className ?? ''}\`}>
      <h1 data-scamp-id="text_a1b1" className={styles.text_a1b1}>Headline</h1>
      <p data-scamp-id="text_c3d3" className={styles.text_c3d3}>Subtitle</p>
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

.text_c3d3 {
    color: #444444;
    font-size: 14px;
}
`;

test.describe('the Data tab follows the selection', () => {
  test.use({
    projectOptions: {
      format: 'scamp',
      pageContent: { home: { tsx: VIEW_TSX, css: VIEW_CSS } },
    },
  });

  test('shows the selected text only, and offers the rest', async ({ window }) => {
    await expect(pageRoot(window)).toBeVisible();

    await layersRowByClass(window, 'text_a1b1').locator('button').first().click();
    await window.getByRole('radio', { name: 'Data' }).click();

    // One row: the selected one.
    const panel = window.getByTestId('properties-panel');
    await expect(panel.getByRole('radio', { name: 'Locked' })).toHaveCount(1);
    await expect(panel.getByText('Headline', { exact: true })).toBeVisible();
    await expect(panel.getByText('Subtitle', { exact: true })).toHaveCount(0);

    // And a way back to the whole view.
    await expect(panel.getByTestId('data-filter-bar')).toBeVisible();
    await panel.getByRole('button', { name: 'Show all' }).click();
    await expect(panel.getByRole('radio', { name: 'Locked' })).toHaveCount(2);
    await expect(panel.getByText('Subtitle', { exact: true })).toBeVisible();

    // Selecting the other text narrows again, to that one.
    await layersRowByClass(window, 'text_c3d3').locator('button').first().click();
    await expect(panel.getByRole('radio', { name: 'Locked' })).toHaveCount(1);
    await expect(panel.getByText('Subtitle', { exact: true })).toBeVisible();
    await expect(panel.getByText('Headline', { exact: true })).toHaveCount(0);
  });

  test('marks the selected text as a prop from that one row', async ({ window }) => {
    await expect(pageRoot(window)).toBeVisible();
    await layersRowByClass(window, 'text_a1b1').locator('button').first().click();
    await window.getByRole('radio', { name: 'Data' }).click();

    const panel = window.getByTestId('properties-panel');
    await panel.getByRole('radio', { name: 'Prop' }).click();
    await expect(panel.getByLabel('Prop name')).toBeVisible();
  });
});
