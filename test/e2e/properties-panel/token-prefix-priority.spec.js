import { promises as fs } from 'fs';
import * as path from 'path';
import { test, expect } from '../fixtures/app';
import { drawAndSelectRect, panelSection } from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { waitForSaved } from '../fixtures/assertions';
// A theme with one token of each length role, so prioritization is
// observable: whichever role matches the field should sort to the top.
const THEME = `:root {
  --space-4: 16px;
  --border-thin: 1px;
  --radius-md: 8px;
}
`;
const seedTheme = async (dir) => {
    await fs.writeFile(path.join(dir, 'theme.css'), THEME, 'utf-8');
};
// The first token option in a popover (token names start with `--`;
// this skips native <option>s like the border-style select).
const firstTokenOption = (window) => window.getByRole('option', { name: /^--/ }).first();
test.describe('properties panel: token prefix prioritization', () => {
    test('border-width picker floats --border tokens to the top', async ({ window, project, }) => {
        await seedTheme(project.dir);
        await expect(pageRoot(window)).toBeVisible();
        await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        await panelSection(window, 'Border')
            .getByRole('button', { name: 'Pick W token' })
            .click();
        await expect(firstTokenOption(window)).toContainText('--border-thin');
    });
    test('radius picker floats --radius tokens to the top', async ({ window, project, }) => {
        await seedTheme(project.dir);
        await expect(pageRoot(window)).toBeVisible();
        await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        await panelSection(window, 'Border')
            .getByRole('button', { name: 'Pick R token' })
            .click();
        await expect(firstTokenOption(window)).toContainText('--radius-md');
    });
    test('padding picker floats --space tokens to the top', async ({ window, project, }) => {
        await seedTheme(project.dir);
        await expect(pageRoot(window)).toBeVisible();
        await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        await panelSection(window, 'Spacing')
            .getByRole('button', { name: 'Pick Padding token' })
            .click();
        await expect(firstTokenOption(window)).toContainText('--space-4');
    });
});
