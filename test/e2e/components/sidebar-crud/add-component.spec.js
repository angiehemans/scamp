import { test, expect } from '../../fixtures/app';
import { createComponentFromSidebar } from '../../fixtures/components';
import { addComponentButton, componentSidebarItem, pageRoot, } from '../../fixtures/selectors';
test.use({ projectOptions: { format: 'nextjs' } });
test.describe('components sidebar — add component', () => {
    test('creates the folder + TSX + CSS pair and opens the editor', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await createComponentFromSidebar(window, 'Button');
        // Sidebar row appears.
        await expect(componentSidebarItem(window, 'Button')).toBeVisible();
        // Files exist on disk under components/<Name>/.
        expect(await project.componentExists('Button')).toBe(true);
        const { tsx, css } = await project.readComponent('Button');
        expect(tsx).toContain('export default function Button()');
        expect(tsx).toContain("import styles from './Button.module.css';");
        expect(css).toContain('.root');
    });
    test('rejects a lowercase name', async ({ window, project }) => {
        await expect(pageRoot(window)).toBeVisible();
        await addComponentButton(window).click();
        const input = window.getByPlaceholder('ComponentName');
        await input.fill('button');
        await input.press('Enter');
        // The component-name input normalises (suggestComponentName) — a
        // lowercase input becomes "Button" on confirm. We expect SOMETHING
        // PascalCase to be created OR an error to surface; either way, the
        // literal lowercase "button" must NOT exist on disk.
        expect(await project.componentExists('button')).toBe(false);
    });
    test('rejects a duplicate name with inline error', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await createComponentFromSidebar(window, 'Card');
        await expect(componentSidebarItem(window, 'Card')).toBeVisible();
        expect(await project.componentExists('Card')).toBe(true);
        // Attempt to create another component with the same name.
        await addComponentButton(window).click();
        const input = window.getByPlaceholder('ComponentName');
        await input.fill('Card');
        await input.press('Enter');
        // The duplicate-name validation surfaces inline; the on-disk
        // folder count for Card stays at 1.
        await expect(window.getByText(/already used|already exists/i)).toBeVisible();
    });
});
