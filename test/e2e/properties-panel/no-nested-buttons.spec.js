import { test, expect } from '../fixtures/app';
import { drawAndSelectRect, panelSection } from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
/**
 * A section header is one clickable bar that also contains real buttons —
 * the group eye toggle and the preset menu. It used to be built as a
 * `<button>` wrapping them, which is invalid HTML: React warns
 * `validateDOMNesting(...): <button> cannot appear as a descendant of
 * <button>`, and nested interactive elements quietly break keyboard and
 * screen-reader traversal.
 *
 * It is now an empty stretched button with the content as siblings, so
 * this asserts both the absence of the warning and the absence of the
 * nesting — and that the header still toggles.
 */
test.describe('properties panel: interactive nesting', () => {
    test('no button is rendered inside another button', async ({ window }) => {
        const warnings = [];
        window.on('console', (message) => {
            if (message.text().includes('validateDOMNesting')) {
                warnings.push(message.text());
            }
        });
        await expect(pageRoot(window)).toBeVisible();
        // Selecting an element renders the full panel — Shadows (preset menu)
        // and the group-toggle sections are the ones that used to nest.
        await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await expect(panelSection(window, 'Shadow')).toBeVisible();
        expect(await window.evaluate(() => document.querySelectorAll('button button').length)).toBe(0);
        expect(warnings).toEqual([]);
    });
    test('the section header still collapses and expands', async ({ window }) => {
        // The stretched button covers the row, and the title and chevron pass
        // their clicks through to it. If that breaks, the header looks fine
        // and does nothing.
        await expect(pageRoot(window)).toBeVisible();
        await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        const section = panelSection(window, 'Shadow');
        const toggle = section.getByRole('button', { name: 'Shadow' }).first();
        const before = await toggle.getAttribute('aria-expanded');
        await toggle.click();
        await expect(toggle).not.toHaveAttribute('aria-expanded', before ?? '');
    });
});
