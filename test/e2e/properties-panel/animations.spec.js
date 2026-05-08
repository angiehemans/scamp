import { test, expect } from '../fixtures/app';
import { drawAndSelectRect, panelSection } from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';
/**
 * The Animation section's preset picker writes an `animation` shorthand
 * onto the element AND ensures the matching `@keyframes` block is in
 * the CSS file. Setting the preset back to None removes both.
 */
test.describe('properties panel: animations', () => {
    test('picking a preset writes animation shorthand + @keyframes block', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        const animation = panelSection(window, 'Animation');
        // The section is collapsible and starts closed when no animation
        // is set — open it.
        await animation.getByRole('button', { name: 'Animation' }).click();
        const presetSelect = animation.locator('select').first();
        await presetSelect.selectOption('fade-in-up');
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        // The element class block carries the `animation` shorthand.
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*animation:\\s*fade-in-up`, 's'));
        // And the page-level @keyframes block exists.
        expect(css).toMatch(/@keyframes\s+fade-in-up\s*\{/);
    });
    test('switching presets updates the animation name in CSS', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        const animation = panelSection(window, 'Animation');
        await animation.getByRole('button', { name: 'Animation' }).click();
        const presetSelect = animation.locator('select').first();
        await presetSelect.selectOption('pulse');
        await waitForSaved(window);
        let { css } = await readPageFiles(project.dir, project.pageName);
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*animation:\\s*pulse`, 's'));
        // Switch to a different preset.
        await presetSelect.selectOption('spin');
        await waitForSaved(window);
        ({ css } = await readPageFiles(project.dir, project.pageName));
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*animation:\\s*spin`, 's'));
    });
    test('setting None via the Remove button drops the animation declaration', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        const animation = panelSection(window, 'Animation');
        await animation.getByRole('button', { name: 'Animation' }).click();
        await animation.locator('select').first().selectOption('fade-in');
        await waitForSaved(window);
        // The Remove affordance lives in the section's actions row once a
        // preset is active.
        await animation.getByRole('button', { name: /✕\s*Remove/ }).click();
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        const block = css.match(new RegExp(`\\.${className}\\s*\\{[^}]*\\}`, 's'))?.[0];
        expect(block).toBeDefined();
        expect(block).not.toMatch(/animation:/);
    });
    test('Duration field rewrites the animation timing', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        const animation = panelSection(window, 'Animation');
        await animation.getByRole('button', { name: 'Animation' }).click();
        await animation.locator('select').first().selectOption('pulse');
        await waitForSaved(window);
        // Duration is the first <input> in the section (preset + easing /
        // direction / fill-mode / play-state are all <select>s, leaving
        // only the NumberInputs as <input> elements). Order: Duration,
        // Delay, Iteration.
        const durationInput = animation.locator('input').first();
        await durationInput.click({ clickCount: 3 });
        await durationInput.fill('1500');
        await durationInput.press('Enter');
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*animation:\\s*pulse\\s+1500ms`, 's'));
    });
    test('Easing / Delay / Direction / Fill-mode flow into the shorthand', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        const animation = panelSection(window, 'Animation');
        await animation.getByRole('button', { name: 'Animation' }).click();
        // Once a preset is active the section renders 4 <select>s in
        // order: 1) Preset, 2) Easing, 3) Direction, 4) Fill mode.
        await animation.locator('select').first().selectOption('pulse');
        await waitForSaved(window);
        await animation.locator('select').nth(1).selectOption('linear');
        await animation.locator('select').nth(2).selectOption('reverse');
        await animation.locator('select').nth(3).selectOption('forwards');
        // Delay is the second <input> (after Duration). 250ms.
        const delay = animation.locator('input').nth(1);
        await delay.click({ clickCount: 3 });
        await delay.fill('250');
        await delay.press('Enter');
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        const shorthand = css.match(new RegExp(`\\.${className}[^}]*animation:\\s*([^;]+);`, 's'))?.[1];
        expect(shorthand).toBeDefined();
        // Each changed token must survive into the shorthand. Order in
        // generateCode is `name duration easing delay iter direction
        // fill-mode play-state`; reverse / forwards are non-default so
        // they always emit.
        expect(shorthand).toContain('linear');
        expect(shorthand).toContain('250ms');
        expect(shorthand).toContain('reverse');
        expect(shorthand).toContain('forwards');
    });
    test('Play state segmented control toggles running ↔ paused', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        const animation = panelSection(window, 'Animation');
        await animation.getByRole('button', { name: 'Animation' }).click();
        await animation.locator('select').first().selectOption('pulse');
        await waitForSaved(window);
        // Play-state SegmentedControl options carry ▶/⏸ glyphs; the
        // radios' accessible names contain "Paused" / "Running".
        await animation.getByRole('radio', { name: /Paused/ }).click();
        await waitForSaved(window);
        let { css } = await readPageFiles(project.dir, project.pageName);
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*animation:[^;]*paused`, 's'));
        await animation.getByRole('radio', { name: /Running/ }).click();
        await waitForSaved(window);
        ({ css } = await readPageFiles(project.dir, project.pageName));
        // `running` is the default — switching back drops the token from
        // the shorthand entirely.
        const shorthand = css.match(new RegExp(`\\.${className}[^}]*animation:\\s*([^;]+);`, 's'))?.[1];
        expect(shorthand).toBeDefined();
        expect(shorthand).not.toContain('paused');
    });
    test('per-state hover animation emits :hover { animation: ... }', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        // Switch to Hover state, then pick a preset. The animation lands
        // on the hover override, not the base.
        await window
            .getByRole('radiogroup', { name: 'Element state' })
            .getByRole('radio', { name: /Hover/ })
            .click();
        const animation = panelSection(window, 'Animation');
        await animation.getByRole('button', { name: 'Animation' }).click();
        await animation.locator('select').first().selectOption('shake');
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        expect(css).toMatch(new RegExp(`\\.${className}:hover\\s*\\{[^}]*animation:\\s*shake`, 's'));
        // The base block should NOT have the animation.
        const baseBlock = css.match(new RegExp(`\\.${className}\\s*\\{[^}]*\\}`, 's'))?.[0];
        expect(baseBlock).toBeDefined();
        expect(baseBlock).not.toMatch(/animation:/);
    });
    test('Iteration popover toggles between Number and Infinite', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        const animation = panelSection(window, 'Animation');
        await animation.getByRole('button', { name: 'Animation' }).click();
        await animation.locator('select').first().selectOption('pulse');
        await waitForSaved(window);
        // Click the iteration caret to open the popover, then pick
        // "Infinite". The shorthand should grow an `infinite` token.
        await animation
            .getByRole('button', { name: 'Iteration mode' })
            .click();
        await animation
            .getByRole('menuitemradio', { name: /Infinite/ })
            .click();
        await waitForSaved(window);
        let { css } = await readPageFiles(project.dir, project.pageName);
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*animation:[^;]*infinite`, 's'));
        // Switch back to Number — the `infinite` token disappears.
        await animation
            .getByRole('button', { name: 'Iteration mode' })
            .click();
        await animation
            .getByRole('menuitemradio', { name: /^Number/ })
            .click();
        await waitForSaved(window);
        ({ css } = await readPageFiles(project.dir, project.pageName));
        const shorthand = css.match(new RegExp(`\\.${className}[^}]*animation:\\s*([^;]+);`, 's'))?.[1];
        expect(shorthand).toBeDefined();
        expect(shorthand).not.toContain('infinite');
    });
    test('▶ Play preview button is present and click does not error', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        const animation = panelSection(window, 'Animation');
        await animation.getByRole('button', { name: 'Animation' }).click();
        await animation.locator('select').first().selectOption('pulse');
        await waitForSaved(window);
        // The Play preview button label uses the ▶ glyph. The click
        // increments a preview counter that triggers a remount of the
        // selected canvas element via React's `key`. The visible side
        // effect is only mid-animation (paint), so we just smoke-test
        // that the button exists, is clickable, and doesn't raise.
        const play = animation.getByRole('button', { name: /Play preview/ });
        await expect(play).toBeVisible();
        await play.click();
    });
});
