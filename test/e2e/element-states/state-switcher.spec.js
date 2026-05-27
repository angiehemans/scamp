import { test, expect } from '../fixtures/app';
import { commitInput, drawAndSelectRect, panelInputByPrefix, panelSection, } from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';
/**
 * The State Switcher sits above the panel sections (Default / Hover /
 * Active / Focus). Edits while a non-default state is active land in
 * `element.stateOverrides[state]`, and the generator emits matching
 * `:hover` / `:active` / `:focus` rule blocks. A small dot appears
 * next to a state's button when that state has at least one override
 * registered.
 */
test.describe('element states: state switcher', () => {
    test('the switcher renders four buttons when an element is selected', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        const switcher = window.getByRole('radiogroup', {
            name: 'Element state',
        });
        await expect(switcher).toBeVisible();
        await expect(switcher.getByRole('radio', { name: 'Default' })).toBeVisible();
        await expect(switcher.getByRole('radio', { name: /Hover/ })).toBeVisible();
        await expect(switcher.getByRole('radio', { name: /Active/ })).toBeVisible();
        await expect(switcher.getByRole('radio', { name: /Focus/ })).toBeVisible();
    });
    test('editing in Hover writes a :hover rule block', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        // Switch the panel to Hover state.
        await window
            .getByRole('radiogroup', { name: 'Element state' })
            .getByRole('radio', { name: /Hover/ })
            .click();
        // Change opacity in the Visibility section. Edits land in the
        // hover override, not the base.
        const opacityInput = panelSection(window, 'Visibility')
            .locator('input')
            .first();
        await opacityInput.click({ clickCount: 3 });
        await opacityInput.fill('50');
        await opacityInput.press('Enter');
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        // Look for the `.{className}:hover { ... opacity: 0.5; ... }` block.
        expect(css).toMatch(new RegExp(`\\.${className}:hover\\s*\\{[^}]*opacity:\\s*0\\.5`, 's'));
    });
    test('editing in Active and Focus writes their respective blocks', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        const switcher = window.getByRole('radiogroup', {
            name: 'Element state',
        });
        // Active → opacity 80
        await switcher.getByRole('radio', { name: /Active/ }).click();
        let opacity = panelSection(window, 'Visibility').locator('input').first();
        await opacity.click({ clickCount: 3 });
        await opacity.fill('80');
        await opacity.press('Enter');
        await waitForSaved(window);
        // Focus → opacity 90
        await switcher.getByRole('radio', { name: /Focus/ }).click();
        opacity = panelSection(window, 'Visibility').locator('input').first();
        await opacity.click({ clickCount: 3 });
        await opacity.fill('90');
        await opacity.press('Enter');
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        expect(css).toMatch(new RegExp(`\\.${className}:active\\s*\\{[^}]*opacity:\\s*0\\.8`, 's'));
        expect(css).toMatch(new RegExp(`\\.${className}:focus\\s*\\{[^}]*opacity:\\s*0\\.9`, 's'));
    });
    test('the state-dot indicator appears on Hover after an override is added', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        const switcher = window.getByRole('radiogroup', {
            name: 'Element state',
        });
        const hoverButton = switcher.getByRole('radio', { name: /Hover/ });
        // Before any edits the dot's accessible label "has overrides" is
        // not present.
        await expect(hoverButton.locator('[aria-label="has overrides"]')).toHaveCount(0);
        // Switch to Hover, change a property → an override is registered.
        await hoverButton.click();
        const opacity = panelSection(window, 'Visibility').locator('input').first();
        await opacity.click({ clickCount: 3 });
        await opacity.fill('50');
        await opacity.press('Enter');
        await waitForSaved(window);
        // Switch back to Default so the Hover button is no longer the
        // active radio (the dot still shows for inactive states).
        await switcher.getByRole('radio', { name: 'Default' }).click();
        await expect(hoverButton.locator('[aria-label="has overrides"]')).toBeVisible();
    });
    test('Default state edits the base, leaving any state blocks intact', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        const switcher = window.getByRole('radiogroup', {
            name: 'Element state',
        });
        // Hover-state edit first.
        await switcher.getByRole('radio', { name: /Hover/ }).click();
        const opacityHover = panelSection(window, 'Visibility')
            .locator('input')
            .first();
        await opacityHover.click({ clickCount: 3 });
        await opacityHover.fill('50');
        await opacityHover.press('Enter');
        await waitForSaved(window);
        // Back to Default and edit width via the Size section.
        await switcher.getByRole('radio', { name: 'Default' }).click();
        const widthInput = panelInputByPrefix(window, 'Size', 'W');
        await commitInput(widthInput, '320');
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        // Base block has the new width.
        expect(css).toMatch(new RegExp(`\\.${className}\\s*\\{[^}]*width:\\s*320px`, 's'));
        // :hover block is preserved with the earlier opacity edit.
        expect(css).toMatch(new RegExp(`\\.${className}:hover\\s*\\{[^}]*opacity:\\s*0\\.5`, 's'));
    });
    test('right-click override dot resets the state-axis override', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        const switcher = window.getByRole('radiogroup', {
            name: 'Element state',
        });
        await switcher.getByRole('radio', { name: /Hover/ }).click();
        // Make a hover override.
        const opacity = panelSection(window, 'Visibility')
            .locator('input')
            .first();
        await opacity.click({ clickCount: 3 });
        await opacity.fill('50');
        await opacity.press('Enter');
        await waitForSaved(window);
        // The Visibility section's override dot should be present while
        // we're on the Hover axis.
        const visibility = panelSection(window, 'Visibility');
        const overrideDot = visibility.getByTestId('override-dot');
        await expect(overrideDot).toBeVisible();
        // Right-click the dot → resets the state-axis override.
        await overrideDot.click({ button: 'right' });
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        // The :hover block is gone.
        const hoverBlock = css.match(new RegExp(`\\.${className}:hover\\s*\\{[^}]*\\}`, 's'));
        expect(hoverBlock).toBeNull();
    });
    test('non-desktop breakpoints disable the non-default state buttons', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        const switchBreakpoint = await import('../fixtures/breakpoints').then((m) => m.switchBreakpoint);
        await switchBreakpoint(window, 'tablet', 'Tablet');
        const switcher = window.getByRole('radiogroup', {
            name: 'Element state',
        });
        await expect(switcher.getByRole('radio', { name: /Hover/ })).toBeDisabled();
        await expect(switcher.getByRole('radio', { name: /Active/ })).toBeDisabled();
        await expect(switcher.getByRole('radio', { name: /Focus/ })).toBeDisabled();
        // Default still works.
        await expect(switcher.getByRole('radio', { name: 'Default' })).toBeEnabled();
    });
});
