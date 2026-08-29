import { test, expect } from '../fixtures/app';
import { drawAndSelectRect } from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
test('probe: no nested-button warnings', async ({ window }) => {
    const warnings = [];
    window.on('console', (m) => {
        if (m.text().includes('validateDOMNesting'))
            warnings.push(m.text());
    });
    await expect(pageRoot(window)).toBeVisible();
    await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
    await window.waitForTimeout(1500);
    console.log('NESTING WARNINGS:', warnings.length, warnings[0] ?? '');
    const nested = await window.evaluate(() => document.querySelectorAll('button button').length);
    console.log('BUTTONS INSIDE BUTTONS:', nested);
});
