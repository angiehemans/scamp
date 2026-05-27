import { test, expect } from '../fixtures/app';
import { pageRoot } from '../fixtures/selectors';
/**
 * Terminal specs depend on node-pty rebuilding correctly for the test
 * Electron — skip on CI where native modules are flaky. Locally the
 * `postinstall` rebuild hook has usually taken care of this.
 */
test.describe('terminal: toggle panel', () => {
    test.skip(process.env['CI'] === 'true', 'node-pty native module is flaky on CI');
    test('Ctrl+` opens the terminal panel', async ({ window }) => {
        await expect(pageRoot(window)).toBeVisible();
        // Not visible yet — the panel lazily mounts on first open.
        await expect(window.getByTestId('terminal-panel')).toHaveCount(0);
        await window.keyboard.press('Control+`');
        await expect(window.getByTestId('terminal-panel')).toHaveAttribute('data-hidden', 'false');
        // Closing the panel via Ctrl+` isn't tested here — once xterm
        // is focused its hidden textarea captures the keystroke before
        // it can reach ProjectShell's window-level handler, so the
        // shortcut round-trip is only observable with a manual focus
        // dance. The toolbar-button toggle covers the close path.
    });
    test('the "Terminal" toolbar button toggles the panel too', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await window.getByRole('button', { name: /^Terminal/ }).click();
        await expect(window.getByTestId('terminal-panel')).toHaveAttribute('data-hidden', 'false');
        await window.getByRole('button', { name: /^Terminal/ }).click();
        await expect(window.getByTestId('terminal-panel')).toHaveAttribute('data-hidden', 'true');
    });
});
