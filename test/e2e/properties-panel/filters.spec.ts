import { test, expect } from '../fixtures/app';
import { commitInput, drawAndSelectRect, panelSection } from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';

test.describe('properties panel: filters', () => {
  test('"+ Add filter" emits a default filter shorthand', async ({
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

    const filters = panelSection(window, 'Filters');
    // The section is collapsible and starts collapsed when no filters
    // are set — open it before clicking the add button.
    await filters.getByRole('button', { name: 'Filters' }).click();

    await filters.getByRole('button', { name: '+ Add filter' }).click();
    await waitForSaved(window);

    const { css } = await readPageFiles(project.dir, project.pageName);
    // Default: blur(4px).
    expect(css).toMatch(
      new RegExp(`\\.${className}[^}]*filter:\\s*blur\\(4px\\)`, 's')
    );
  });

  test('multiple filters emit a space-joined list', async ({
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

    const filters = panelSection(window, 'Filters');
    await filters.getByRole('button', { name: 'Filters' }).click();
    const addButton = filters.getByRole('button', { name: '+ Add filter' });
    await addButton.click();
    await addButton.click();
    await waitForSaved(window);

    const { css } = await readPageFiles(project.dir, project.pageName);
    const block = css.match(
      new RegExp(`\\.${className}\\s*\\{[^}]*\\}`, 's')
    )?.[0];
    expect(block).toBeDefined();
    const filterLine = block!.match(/filter:\s*([^;]+);/)?.[1];
    expect(filterLine).toBeDefined();
    // Two default `blur(4px)` entries → exactly one space at the
    // top level between the two function calls.
    expect(filterLine!.trim()).toBe('blur(4px) blur(4px)');
  });

  test('changing the kind dropdown resets the value to that kind\'s default', async ({
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

    const filters = panelSection(window, 'Filters');
    await filters.getByRole('button', { name: 'Filters' }).click();
    await filters.getByRole('button', { name: '+ Add filter' }).click();
    await waitForSaved(window);

    // Switch the kind dropdown from blur → brightness.
    await filters.locator('select').first().selectOption('brightness');
    await waitForSaved(window);

    const { css } = await readPageFiles(project.dir, project.pageName);
    // brightness's canonical default is 100%.
    expect(css).toMatch(
      new RegExp(`\\.${className}[^}]*filter:\\s*brightness\\(100%\\)`, 's')
    );
  });

  test('changing the value input rewrites the filter argument', async ({
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

    const filters = panelSection(window, 'Filters');
    await filters.getByRole('button', { name: 'Filters' }).click();
    await filters.getByRole('button', { name: '+ Add filter' }).click();
    await waitForSaved(window);

    // Edit the value field of the first filter row from 4 → 20.
    const valueInput = filters.locator('input[inputmode="numeric"]').first();
    await commitInput(valueInput, '20');
    await waitForSaved(window);

    const { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).toMatch(
      new RegExp(`\\.${className}[^}]*filter:\\s*blur\\(20px\\)`, 's')
    );
  });

  test('remove button drops a filter row from the CSS', async ({
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

    const filters = panelSection(window, 'Filters');
    await filters.getByRole('button', { name: 'Filters' }).click();
    const addButton = filters.getByRole('button', { name: '+ Add filter' });
    await addButton.click();
    await addButton.click();
    await waitForSaved(window);

    // Remove the first filter row — both default to blur(4px), so
    // we just check that exactly one filter remains.
    await filters
      .getByRole('button', { name: 'Remove filter 1' })
      .click();
    await waitForSaved(window);

    const { css } = await readPageFiles(project.dir, project.pageName);
    const block = css.match(
      new RegExp(`\\.${className}\\s*\\{[^}]*\\}`, 's')
    )?.[0];
    expect(block).toBeDefined();
    const filterLine = block!.match(/filter:\s*([^;]+);/)?.[1];
    expect(filterLine).toBeDefined();
    // One function call, no space-separated tokens.
    expect(filterLine!.trim()).toBe('blur(4px)');
  });

  test('all filter rows removed drops the declaration entirely', async ({
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

    const filters = panelSection(window, 'Filters');
    await filters.getByRole('button', { name: 'Filters' }).click();
    await filters.getByRole('button', { name: '+ Add filter' }).click();
    await waitForSaved(window);

    await filters
      .getByRole('button', { name: 'Remove filter 1' })
      .click();
    await waitForSaved(window);

    const { css } = await readPageFiles(project.dir, project.pageName);
    const block = css.match(
      new RegExp(`\\.${className}\\s*\\{[^}]*\\}`, 's')
    )?.[0];
    expect(block).toBeDefined();
    // No filter declaration at all once the last row is gone.
    expect(block).not.toMatch(/\bfilter:/);
  });

  test('enabling the backdrop toggle reveals a separate add button', async ({
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

    const filters = panelSection(window, 'Filters');
    await filters.getByRole('button', { name: 'Filters' }).click();

    // Backdrop is hidden by default. Enable it.
    await filters.getByLabel('Enable').check();

    // The backdrop add button is now visible. Click it.
    await filters
      .getByRole('button', { name: '+ Add backdrop filter' })
      .click();
    await waitForSaved(window);

    const { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).toMatch(
      new RegExp(`\\.${className}[^}]*backdrop-filter:\\s*blur\\(4px\\)`, 's')
    );
    // Main filter list stays untouched (and absent).
    const block = css.match(
      new RegExp(`\\.${className}\\s*\\{[^}]*\\}`, 's')
    )?.[0];
    expect(block).toBeDefined();
    expect(block).not.toMatch(/^\s*filter:/m);
  });
});
