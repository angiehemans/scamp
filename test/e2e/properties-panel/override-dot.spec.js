import { test, expect } from '../fixtures/app';
import { switchBreakpoint } from '../fixtures/breakpoints';
import { commitInput, drawAndSelectRect, panelInputByPrefix, panelSection, } from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';
test.describe('properties panel: override indicator dot', () => {
    test('no dot at desktop even when base styles are set', async ({ window }) => {
        await expect(pageRoot(window)).toBeVisible();
        await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await commitInput(panelInputByPrefix(window, 'Spacing', 'P'), '16');
        await waitForSaved(window);
        // Desktop is the base — sections never show the override dot there.
        await expect(panelSection(window, 'Spacing').locator('[data-testid="override-dot"]')).toHaveCount(0);
    });
    test('dot appears next to Spacing after a Tablet-scoped padding edit', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await commitInput(panelInputByPrefix(window, 'Spacing', 'P'), '24');
        await waitForSaved(window);
        await switchBreakpoint(window, 'tablet', 'Tablet');
        await commitInput(panelInputByPrefix(window, 'Spacing', 'P'), '12');
        await waitForSaved(window);
        // Override dot now sits next to the Spacing section heading.
        const dot = panelSection(window, 'Spacing').locator('[data-testid="override-dot"]');
        await expect(dot).toBeVisible();
        // Other sections still have no dot — nothing overridden there.
        await expect(panelSection(window, 'Border').locator('[data-testid="override-dot"]')).toHaveCount(0);
    });
    test('right-clicking the dot resets the section overrides at the active breakpoint', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await commitInput(panelInputByPrefix(window, 'Spacing', 'P'), '24');
        await waitForSaved(window);
        await switchBreakpoint(window, 'tablet', 'Tablet');
        await commitInput(panelInputByPrefix(window, 'Spacing', 'P'), '12');
        await waitForSaved(window);
        let { css } = await readPageFiles(project.dir, project.pageName);
        expect(css).toMatch(/@media \(max-width: 768px\)/);
        // Right-click the dot to reset this section's overrides.
        const dot = panelSection(window, 'Spacing').locator('[data-testid="override-dot"]');
        await dot.click({ button: 'right' });
        await waitForSaved(window);
        ({ css } = await readPageFiles(project.dir, project.pageName));
        // The Tablet block no longer carries the padding override — and
        // since padding was the only override in that block, the whole
        // @media block disappears.
        expect(css).not.toMatch(/@media \(max-width: 768px\)/);
        // Base padding (24px) is untouched.
        expect(css).toMatch(new RegExp(`\\.${className}\\s*\\{[^}]*padding:\\s*24px`));
        // Dot goes away once overrides are cleared in the section.
        await expect(dot).toHaveCount(0);
    });
});
