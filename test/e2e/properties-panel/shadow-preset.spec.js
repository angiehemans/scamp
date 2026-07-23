import { promises as fs } from 'fs';
import * as path from 'path';
import { test, expect } from '../fixtures/app';
import { drawAndSelectRect, panelSection } from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';
const THEME = `:root {
  --color-text: #111;
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06);
}
`;
test.describe('properties panel: shadow preset', () => {
    test('picking a shadow preset replaces the shadow rows with the token value', async ({ window, project, }) => {
        await fs.writeFile(path.join(project.dir, 'theme.css'), THEME, 'utf-8');
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        const shadows = panelSection(window, 'Shadow');
        // The preset icon lives in the header next to the chevron — reachable
        // without expanding. (The collapse toggle is the button with an
        // expanded state; the header's preset button has no such state.)
        await shadows.getByTestId('shadow-preset-select').click();
        await window.getByRole('option', { name: /--shadow-md/ }).click();
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        // The preset resolves into structured rows → emitted as the multi-layer
        // box-shadow shorthand (lengths normalised to px).
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*box-shadow:\\s*0px 4px 6px rgba\\(0, 0, 0, 0\\.07\\), 0px 2px 4px rgba\\(0, 0, 0, 0\\.06\\)`, 's'));
    });
});
