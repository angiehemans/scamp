import { test, expect } from '../fixtures/app';
import {
  commitInput,
  drawAndSelectRect,
  panelSection,
} from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';

/**
 * The "Link to" field in the Element section commits a link in three
 * shapes depending on the current tag:
 *   - Already `<a>`: writes/edits the href attribute.
 *   - Tag-swappable (`<div>`, `<p>`, `<span>`, `<button>`): converts
 *     the tag to `<a>` AND sets the href in one patch.
 *   - Wrap-only (`<img>`, `<video>`, `<iframe>`, `<svg>`, `<input>`):
 *     wraps the element in a new `<a>` parent.
 *
 * The fixture project ships with a single page (`home`), so the page
 * dropdown's only option is "home" and picking "Page" from the
 * destination dropdown immediately commits `href="/home"`.
 */
test.describe('linking: link field', () => {
  test('picking Page on a div rect converts it to <a> with the page href', async ({
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

    const elementSection = panelSection(window, 'Element');
    // Selects in order: 1) Tag, 2) Destination ("Link to"), 3) Page
    // (only when destination=page).
    const destination = elementSection.locator('select').nth(1);
    await destination.selectOption('page');
    await waitForSaved(window);

    const { tsx } = await readPageFiles(project.dir, project.pageName);
    // Tag should now be `<a>` with `data-scamp-id` matching the
    // original rect's class name. The fixture project has `home` as
    // its only page, which maps to "/" (the index page convention).
    expect(tsx).toMatch(
      new RegExp(`<a [^>]*data-scamp-id="${className}"[^>]*href="/"`)
    );
  });

  test('typing an external URL converts to <a> and sets href', async ({
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

    const elementSection = panelSection(window, 'Element');
    const destination = elementSection.locator('select').nth(1);
    await destination.selectOption('external');

    // External URL input appears with placeholder "https://example.com".
    const urlInput = elementSection.getByPlaceholder('https://example.com');
    await commitInput(urlInput, 'https://scampdesign.app');
    await waitForSaved(window);

    const { tsx } = await readPageFiles(project.dir, project.pageName);
    expect(tsx).toMatch(
      new RegExp(
        `<a [^>]*data-scamp-id="${className}"[^>]*href="https://scampdesign\\.app"`
      )
    );
  });

  test('"Open in new tab" toggle adds target + rel attributes', async ({
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

    const elementSection = panelSection(window, 'Element');
    await elementSection.locator('select').nth(1).selectOption('page');
    await waitForSaved(window);

    // Toggle "Open in new tab" — only visible once the element is
    // an anchor.
    const newTabCheckbox = elementSection.locator('input[type="checkbox"]');
    await newTabCheckbox.check();
    await waitForSaved(window);

    const { tsx } = await readPageFiles(project.dir, project.pageName);
    expect(tsx).toMatch(
      new RegExp(
        `<a [^>]*data-scamp-id="${className}"[^>]*target="_blank"[^>]*rel="noopener noreferrer"`
      )
    );
  });
});
