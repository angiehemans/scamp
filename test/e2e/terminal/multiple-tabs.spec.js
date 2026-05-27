import { test, expect } from '../fixtures/app';
import { pageRoot } from '../fixtures/selectors';
test.describe('terminal: multiple shell tabs', () => {
    test.skip(process.env['CI'] === 'true', 'node-pty native module is flaky on CI');
    test('up to 3 shell tabs; the + button is hidden after the 3rd', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        // Use the toolbar button rather than Ctrl+` — the global keydown
        // listener can race with mount on a cold start, dropping the
        // shortcut. The toolbar button is wired through the same toggle.
        await window.getByRole('button', { name: /^Terminal/ }).click();
        const panel = window.getByTestId('terminal-panel');
        await expect(panel).toHaveAttribute('data-hidden', 'false');
        // Starts with 1 shell (Shell 1) + App Log.
        await expect(panel.getByText('Shell 1', { exact: true })).toBeVisible();
        // Click the "+" new-shell button twice → Shell 2, Shell 3.
        const addTab = panel.getByRole('button', { name: '+', exact: true });
        await addTab.click();
        await expect(panel.getByText('Shell 2', { exact: true })).toBeVisible();
        await addTab.click();
        await expect(panel.getByText('Shell 3', { exact: true })).toBeVisible();
        // At MAX_SHELLS the + button unmounts.
        await expect(panel.getByRole('button', { name: '+', exact: true })).toHaveCount(0);
    });
});
