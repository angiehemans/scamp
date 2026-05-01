import { promises as fs } from 'fs';
import * as path from 'path';
import { test, expect } from '../fixtures/app';
import { closeProjectSettings, openProjectSettings, } from '../fixtures/breakpoints';
import { pageRoot } from '../fixtures/selectors';
test.describe('settings: project fonts', () => {
    test('adding a Google Fonts URL writes an @import to theme.css', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await openProjectSettings(window);
        const url = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap';
        const pasteInput = window.getByPlaceholder(/^Paste a Google Fonts embed link/);
        await pasteInput.fill(url);
        await window.getByRole('button', { name: 'Add', exact: true }).click();
        // Theme panel writes via the theme:write IPC. Poll disk until the
        // import lands.
        await expect
            .poll(async () => fs.readFile(path.join(project.dir, 'theme.css'), 'utf-8'), { timeout: 5_000 })
            .toContain('@import');
        const themeText = await fs.readFile(path.join(project.dir, 'theme.css'), 'utf-8');
        expect(themeText).toContain('fonts.googleapis.com');
        expect(themeText).toContain('Inter');
        await closeProjectSettings(window);
    });
});
