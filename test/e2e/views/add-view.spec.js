import { test, expect } from '../fixtures/app';
import { clickContextMenuItem, confirmDialog, createComponentFromSidebar, createViewFromSidebar, openPagesSection, openViewContextMenu, openViewsSection, waitForConfirmDialog, } from '../fixtures/components';
import { addViewButton, pageRoot, viewSidebarItem, } from '../fixtures/selectors';
test.use({ projectOptions: { format: 'nextjs' } });
/**
 * Views in the sidebar: a view is a component with a page-sized canvas
 * under views/<Name>/, previewed through a one-line wrapper page.
 * see docs/plans/framework-phase-1-plan.md, step 2
 */
test.describe('views sidebar', () => {
    test('creates views/<Name> in the contract shape, a wrapper page, and opens the editor', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await createViewFromSidebar(window, 'HeroCard');
        await expect(viewSidebarItem(window, 'HeroCard')).toBeVisible();
        await expect(window.getByTestId('component-editor-banner')).toContainText('Editing view: HeroCard');
        expect(await project.viewExists('HeroCard')).toBe(true);
        const { tsx, css } = await project.readView('HeroCard');
        expect(tsx).toContain('export default function HeroCard({ className }: HeroCardProps)');
        expect(tsx).toContain('export const _scamp = { contract: 0, events: [] } as const;');
        expect(css).toContain('.root');
        // The wrapper page renders the view but is never listed as a page.
        const wrapper = await project.readFile('app/hero-card/page.tsx');
        expect(wrapper).toContain("import HeroCard from '@/views/HeroCard/HeroCard';");
        expect(wrapper).toContain('return <HeroCard />;');
        expect(await project.fileExists('app/hero-card/page.module.css')).toBe(false);
        await openPagesSection(window);
        await expect(window.getByRole('button', { name: 'hero-card', exact: true })).toHaveCount(0);
    });
    test('a view is not offered as a draggable instance', async ({ window }) => {
        await expect(pageRoot(window)).toBeVisible();
        await createViewFromSidebar(window, 'Landing');
        await expect(viewSidebarItem(window, 'Landing')).toHaveAttribute('draggable', 'false');
    });
    test('rejects a name a component already uses', async ({ window, project }) => {
        await expect(pageRoot(window)).toBeVisible();
        await createComponentFromSidebar(window, 'Card');
        await openViewsSection(window);
        await addViewButton(window).click();
        const input = window.getByPlaceholder('ComponentName');
        await input.fill('Card');
        await input.press('Enter');
        expect(await project.viewExists('Card')).toBe(false);
    });
    test('deleting a view removes its folder and its wrapper page', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await createViewFromSidebar(window, 'Pricing');
        await expect(viewSidebarItem(window, 'Pricing')).toBeVisible();
        expect(await project.fileExists('app/pricing/page.tsx')).toBe(true);
        await openViewContextMenu(window, 'Pricing');
        await clickContextMenuItem(window, 'Delete view');
        await waitForConfirmDialog(window, /Delete view "Pricing"/);
        await confirmDialog(window, /Delete view/);
        await expect(viewSidebarItem(window, 'Pricing')).toHaveCount(0);
        expect(await project.viewExists('Pricing')).toBe(false);
        expect(await project.fileExists('app/pricing/page.tsx')).toBe(false);
    });
});
