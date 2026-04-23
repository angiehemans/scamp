import { test, expect } from '../fixtures/app';
import { pageRoot } from '../fixtures/selectors';

test.describe('terminal: panel persistence', () => {
  test.skip(process.env['CI'] === 'true', 'node-pty native module is flaky on CI');

  test('toggling the panel off preserves the DOM (pty processes keep running)', async ({
    window,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await window.keyboard.press('Control+`');
    const panel = window.getByTestId('terminal-panel');
    await expect(panel).toHaveAttribute('data-hidden', 'false');

    // Add a second shell so we can verify tab state persists through
    // the hide/show cycle.
    await panel.getByRole('button', { name: '+', exact: true }).click();
    await expect(panel.getByText('Shell 2', { exact: true })).toBeVisible();

    // Use the toolbar Terminal button to toggle — xterm consumes
    // Ctrl+` while focused so the window-level shortcut handler
    // never sees it.
    const terminalButton = window.getByRole('button', { name: /^Terminal/ });
    await terminalButton.click();
    await expect(panel).toHaveAttribute('data-hidden', 'true');
    // Shell 2 is still in the DOM (just not visible).
    await expect(panel.getByText('Shell 2', { exact: true })).toBeAttached();

    // Reopen — same tabs are still there.
    await terminalButton.click();
    await expect(panel).toHaveAttribute('data-hidden', 'false');
    await expect(panel.getByText('Shell 1', { exact: true })).toBeVisible();
    await expect(panel.getByText('Shell 2', { exact: true })).toBeVisible();
  });
});
