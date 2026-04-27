import { test, expect } from '../fixtures/app';
import {
  drawAndSelectRect,
  panelInputByPrefix,
  panelSection,
} from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';

test.describe('properties panel: transitions', () => {
  test('adding a transition writes a `transition` shorthand to disk', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    const className = await drawAndSelectRect(
      window,
      { x: 100, y: 100 },
      { x: 260, y: 200 }
    );
    await waitForSaved(window);

    const transitions = panelSection(window, 'Transitions');
    // The section starts collapsed (`defaultOpen={false}` because the
    // empty list shouldn't grab attention) — open it.
    await transitions.getByRole('button', { name: 'Transitions' }).click();

    // Add a row — defaults to `all 200ms ease`.
    await transitions
      .getByRole('button', { name: '+ Add transition' })
      .click();

    await waitForSaved(window);
    let { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).toMatch(
      new RegExp(`\\.${className}[^}]*transition:\\s*all 200ms ease;`, 's')
    );

    // Change the property to opacity and the duration to 300ms.
    const propertySelect = transitions.locator('select').first();
    await propertySelect.selectOption('opacity');
    const durationInput = panelInputByPrefix(window, 'Transitions', 'Dur');
    await durationInput.click({ clickCount: 3 });
    await durationInput.fill('300');
    await durationInput.press('Enter');

    await waitForSaved(window);
    ({ css } = await readPageFiles(project.dir, project.pageName));
    expect(css).toMatch(
      new RegExp(`\\.${className}[^}]*transition:\\s*opacity 300ms ease;`, 's')
    );
  });

  test('multiple transitions emit a comma-separated shorthand and removing one shrinks it', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    const className = await drawAndSelectRect(
      window,
      { x: 100, y: 100 },
      { x: 260, y: 200 }
    );
    await waitForSaved(window);

    const transitions = panelSection(window, 'Transitions');
    await transitions.getByRole('button', { name: 'Transitions' }).click();

    // Add two rows.
    const addButton = transitions.getByRole('button', {
      name: '+ Add transition',
    });
    await addButton.click();
    await addButton.click();
    await waitForSaved(window);

    let { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).toMatch(
      new RegExp(
        `\\.${className}[^}]*transition:\\s*all 200ms ease, all 200ms ease;`,
        's'
      )
    );

    // Remove the first transition row.
    await transitions
      .getByRole('button', { name: 'Remove transition' })
      .first()
      .click();
    await waitForSaved(window);
    ({ css } = await readPageFiles(project.dir, project.pageName));
    // Only one transition left.
    expect(css).toMatch(
      new RegExp(`\\.${className}[^}]*transition:\\s*all 200ms ease;`, 's')
    );
    // No comma in the shorthand → only one entry.
    const block = css.match(
      new RegExp(`\\.${className}\\s*\\{[^}]*\\}`, 's')
    )?.[0];
    expect(block).not.toContain(',');
  });
});
