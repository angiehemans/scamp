import { test, expect } from '../fixtures/app';
import { pageRoot } from '../fixtures/selectors';
// The project view's left icon rail switches the sidebar between Pages,
// Components and History, and launches the Design System (theme) + Settings
// overlays. see docs/plans/icon-sidebar-nav-plan.md
test.use({ projectOptions: { format: 'nextjs' } });
test.describe('project view: sidebar icon rail', () => {
    test('shows five section icons and defaults to Pages', async ({ window }) => {
        await expect(pageRoot(window)).toBeVisible();
        const rail = window.locator('[data-testid="sidebar-rail"]');
        await expect(rail.locator('button')).toHaveCount(5);
        await expect(window.locator('[data-section="pages"]')).toHaveAttribute('aria-pressed', 'true');
        await expect(window.getByRole('button', { name: /\+ Add Page/ })).toBeVisible();
    });
    test('switches the panel between Pages, Components and History', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await window.locator('[data-section="components"]').click();
        await expect(window.getByRole('button', { name: /\+ Add Component/ })).toBeVisible();
        await window.locator('[data-section="history"]').click();
        await expect(window.getByRole('button', { name: 'Save snapshot' })).toBeVisible();
        await window.locator('[data-section="pages"]').click();
        await expect(window.getByRole('button', { name: /\+ Add Page/ })).toBeVisible();
    });
    test('Design System icon opens the theme overlay', async ({ window }) => {
        await expect(pageRoot(window)).toBeVisible();
        await window.locator('[data-section="design-system"]').click();
        await expect(window.getByTestId('theme-panel')).toBeVisible();
    });
    test('Settings opens over the workspace but keeps the rail visible', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const rail = window.locator('[data-testid="sidebar-rail"]');
        await window.locator('[data-section="settings"]').click();
        await expect(window.getByRole('heading', { name: 'Project Settings' })).toBeVisible();
        // The icon rail stays visible (Settings no longer covers the whole shell).
        await expect(rail).toBeVisible();
        await expect(window.locator('[data-section="settings"]')).toHaveAttribute('aria-pressed', 'true');
        // Clicking another section closes Settings and returns to the workspace.
        await window.locator('[data-section="pages"]').click();
        await expect(window.getByRole('heading', { name: 'Project Settings' })).toBeHidden();
        await expect(window.getByRole('button', { name: /\+ Add Page/ })).toBeVisible();
    });
});
