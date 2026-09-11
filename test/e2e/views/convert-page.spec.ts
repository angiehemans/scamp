import { test, expect } from '../fixtures/app';
import {
  clickContextMenuItem,
  confirmDialog,
  openPagesSection,
  openViewsSection,
  waitForConfirmDialog,
} from '../fixtures/components';
import { drawAndSelectRect } from '../fixtures/panel';
import { pageRoot, viewSidebarItem } from '../fixtures/selectors';
import { waitForSaved } from '../fixtures/assertions';

test.use({ projectOptions: { format: 'nextjs' } });

const pagesList = (window: Parameters<typeof pageRoot>[0]) =>
  window.locator('h2:has-text("Pages") + ul');

/** Add a page from the sidebar and switch to it. */
const addPage = async (
  window: Parameters<typeof pageRoot>[0],
  name: string
): Promise<void> => {
  await openPagesSection(window);
  await window.getByRole('button', { name: /\+ Add Page/ }).click();
  const input = window.getByPlaceholder('page-name');
  await input.fill(name);
  await input.press('Enter');
};

/**
 * Convert a page to a view: its elements move to views/<Name>/ in the
 * component file shape, and the page file becomes the one-line wrapper
 * that previews the view at the same route.
 * see docs/plans/framework-phase-1-plan.md, step 2
 */
test.describe('convert a page to a view', () => {
  test('moves the page into views/ and leaves a wrapper at the route', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    // Draw on home, then add a second page so the project keeps a page
    // after home converts.
    const rectId = await drawAndSelectRect(window, { x: 80, y: 80 }, { x: 240, y: 200 });
    await waitForSaved(window);
    await addPage(window, 'about');
    await expect(pagesList(window).getByRole('button', { name: 'about', exact: true })).toBeVisible();

    await pagesList(window)
      .getByRole('button', { name: 'home', exact: true })
      .click({ button: 'right' });
    await clickContextMenuItem(window, 'Convert to view');
    await waitForConfirmDialog(window, /Convert "home" to a view/);
    await confirmDialog(window, /^Convert to view$/);

    // The editor opens on the new view.
    await expect(window.getByTestId('component-editor-banner')).toContainText(
      'Editing view: Home'
    );
    await openViewsSection(window);
    await expect(viewSidebarItem(window, 'Home')).toBeVisible();

    // The elements travelled, in the contract shape, without the page-root floor.
    expect(await project.viewExists('Home')).toBe(true);
    const { tsx, css } = await project.readView('Home');
    expect(tsx).toContain(`data-scamp-id="${rectId}"`);
    expect(tsx).toContain('export default function Home({ className }: HomeProps)');
    expect(tsx).toContain('export const _scamp = { contract: 0, events: [] } as const;');
    expect(css).toContain(`.${rectId}`);
    expect(css).not.toContain('min-height: 100vh');

    // The root page file is now the wrapper, its CSS module is gone, and
    // home no longer lists as a page.
    const wrapper = await project.readFile('app/page.tsx');
    expect(wrapper).toContain("import Home from '@/views/Home/Home';");
    expect(await project.fileExists('app/page.module.css')).toBe(false);
    await openPagesSection(window);
    await expect(pagesList(window).getByRole('button', { name: 'home', exact: true })).toHaveCount(0);
    await expect(pagesList(window).getByRole('button', { name: 'about', exact: true })).toBeVisible();
  });

  test('takes a snapshot first', async ({ window, project }) => {
    await expect(pageRoot(window)).toBeVisible();
    await addPage(window, 'team');
    await waitForSaved(window);
    await pagesList(window)
      .getByRole('button', { name: 'team', exact: true })
      .click({ button: 'right' });
    await clickContextMenuItem(window, 'Convert to view');
    await waitForConfirmDialog(window, /Convert "team" to a view/);
    await confirmDialog(window, /^Convert to view$/);
    await expect(window.getByTestId('component-editor-banner')).toContainText('Editing view: Team');

    const snapshots = await project.listSnapshotLabels();
    expect(snapshots).toContain('Before converting "team" to a view');
  });
});
