import { test, expect } from '../fixtures/app';
import { mappingTrigger, pageRoot } from '../fixtures/selectors';
/**
 * A semantic token used to be mappable only to a primitive, through a
 * palette/shade menu — a hard-coded value could be read but never edited.
 * The row now uses the shared ColorInput, giving three routes: a
 * primitive (its Tokens tab), a typed value (the row's own field), or
 * the colour picker behind the swatch.
 *
 * These cover the typed route and, importantly, that a literal still
 * lands in the right block: a Dark-block edit must not rewrite `:root`.
 * The primitive route stays covered by theme-panel-crud / theme-switcher.
 */
test.use({ projectOptions: { format: 'nextjs' } });
const openPanel = async (window) => {
    await expect(pageRoot(window)).toBeVisible();
    await window.locator('[data-section="design-system"]').click();
    const panel = window.getByTestId('theme-panel');
    await expect(panel).toBeVisible();
    return panel;
};
/**
 * The value field of a semantic row. Each row holds exactly two text
 * inputs — the token name, then the ColorInput's value — so the second
 * is the one that takes a literal.
 */
const valueField = (scope, tokenName) => scope
    .locator('[data-token-row]')
    .filter({ has: scope.page().locator(`input[value="${tokenName}"]`) })
    .locator('input[type="text"]')
    .nth(1);
test.describe('themes: a semantic token can take a literal value', () => {
    test('typing a hex writes the literal, not a var() reference', async ({ window, project, }) => {
        const panel = await openPanel(window);
        const field = valueField(panel, '--color-primary');
        await field.fill('#ff0055');
        await field.press('Enter');
        await expect
            .poll(async () => project.readTheme(), { timeout: 5_000 })
            .toContain('--color-primary: #ff0055');
    });
    test('the swatch still opens the picker for the primitives', async ({ window, }) => {
        const panel = await openPanel(window);
        // Opens on the Tokens tab: mapping to a primitive is the norm here.
        await mappingTrigger(panel, '--color-primary').click();
        await expect(window.getByRole('button', { name: 'Tokens', exact: true })).toBeVisible();
    });
    test('a literal in a theme block writes to that block, not :root', async ({ window, project, }) => {
        const panel = await openPanel(window);
        await panel.getByTestId('add-theme').click();
        const darkBlock = panel.locator('[data-theme-block="dark"]');
        await expect(darkBlock).toBeVisible();
        const field = valueField(darkBlock, '--color-primary');
        await field.fill('#00ddaa');
        await field.press('Enter');
        await expect
            .poll(async () => project.readTheme(), { timeout: 5_000 })
            .toMatch(/\.dark\s*\{[^}]*--color-primary:\s*#00ddaa/);
        // :root keeps its own value — everything before the .dark block.
        const css = await project.readTheme();
        const rootBlock = css.slice(css.indexOf(':root'), css.indexOf('.dark'));
        expect(rootBlock).not.toContain('#00ddaa');
    });
});
