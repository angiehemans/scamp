import { promises as fs } from 'fs';
import * as path from 'path';
import { test, expect } from '../fixtures/app';
import { commitInput, drawAndSelectRect, panelInputByPrefix } from '../fixtures/panel';
import { pageRoot, saveStatus } from '../fixtures/selectors';
import { waitForSaved } from '../fixtures/assertions';
test('probe: state after a duplicate-only external edit', async ({ window, project }) => {
    await expect(pageRoot(window)).toBeVisible();
    const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
    await waitForSaved(window);
    const cssPath = path.join(project.dir, 'home.module.css');
    const original = await fs.readFile(cssPath, 'utf-8');
    const h = original.match(new RegExp(`\\.${className}\\s*\\{([^}]*)\\}`, 's'))?.[1]?.match(/height:\s*[^;]+;/)?.[0];
    await fs.writeFile(cssPath, original.replace(new RegExp(`(\\.${className}\\s*\\{[^}]*)\\}`), `$1  height: 77px;\n}`), 'utf-8');
    await window.waitForTimeout(1200); // let the reload land
    console.log('SELECTED W FIELD VISIBLE:', await panelInputByPrefix(window, 'Size', 'W').isVisible());
    console.log('W VALUE:', await panelInputByPrefix(window, 'Size', 'W').inputValue());
    await commitInput(panelInputByPrefix(window, 'Size', 'W'), '321');
    await window.waitForTimeout(6000);
    console.log('SAVE STATUS:', await saveStatus(window).getAttribute('data-status'));
    const after = await fs.readFile(cssPath, 'utf-8');
    const block = after.match(new RegExp(`\\.${className}\\s*\\{[^}]*\\}`, 's'))?.[0];
    console.log('BLOCK ON DISK:\n' + block);
});
