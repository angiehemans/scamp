import { promises as fs } from 'fs';
import * as path from 'path';

import { test, expect } from '../fixtures/app';
import {
  commitInput,
  drawAndSelectRect,
  panelInputByPrefix,
  panelSection,
} from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';

/**
 * The yellow duplicate-CSS indicator surfaces on a section title when
 * the parser saw the same CSS property declared more than once in the
 * element's class block. Editing any panel field on the affected
 * element rewrites the rule body from typed state, which collapses
 * the duplicate — and the indicator self-heals on the next parse.
 */
test.describe('properties panel: duplicate CSS indicator', () => {
  test('a duplicate height declaration lights up the Size section dot', async ({
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

    // Inject duplicate `height` declarations at the END of the class
    // block, so last-applied wins (`100vh`) and the canvas tree actually
    // changes.
    //
    // Injecting at the START leaves the generator's own `height` last, so
    // the winning value is unchanged, the tree round-trips identically,
    // and `externalEdit` skips the reload — the duplicate indicator then
    // never appears. That is a real gap (a duplicate that changes nothing
    // is exactly the dead weight worth flagging) and it is NOT covered
    // here.
    const cssPath = path.join(project.dir, 'home.module.css');
    const original = await fs.readFile(cssPath, 'utf-8');
    const withDuplicate = original.replace(
      new RegExp(`(\\.${className}\\s*\\{[^}]*)\\}`),
      `$1  height: 100%;\n  height: 100vh;\n}`
    );
    expect(withDuplicate).not.toBe(original);
    await fs.writeFile(cssPath, withDuplicate, 'utf-8');

    // The duplicate-dot is keyed by the section's cssProperties list;
    // the Size section owns `height` so its dot should appear after
    // the next parse cycle.
    const sizeSection = panelSection(window, 'Size');
    await expect(sizeSection.getByTestId('duplicate-dot')).toBeVisible({
      timeout: 10_000,
    });
  });

  test('flags a duplicate even when it does not change the winning value', async ({
    window,
    project,
  }) => {
    // Injected at the START of the block, so the generator's own `height`
    // still wins and the parsed tree round-trips to identical code.
    // `externalEdit` skips the canvas reload in that case — correctly, the
    // tree has not changed — and used to discard the new duplicate
    // information with it. This is the case where the warning matters
    // most: a duplicate that changes nothing is pure dead weight and has
    // no other visible symptom.
    await expect(pageRoot(window)).toBeVisible();
    const className = await drawAndSelectRect(
      window,
      { x: 100, y: 100 },
      { x: 260, y: 200 }
    );
    await waitForSaved(window);

    const cssPath = path.join(project.dir, 'home.module.css');
    const original = await fs.readFile(cssPath, 'utf-8');
    const block = original.match(
      new RegExp(`\\.${className}\\s*\\{([^}]*)\\}`, 's')
    );
    if (!block) throw new Error('no class block');
    const existingHeight = block[1]?.match(/height:\s*[^;]+;/)?.[0];
    if (!existingHeight) throw new Error('no height to duplicate');

    const withDuplicate = original.replace(
      new RegExp(`(\\.${className}\\s*\\{)`),
      `$1\n  ${existingHeight}`
    );
    expect(withDuplicate).not.toBe(original);
    await fs.writeFile(cssPath, withDuplicate, 'utf-8');

    await expect(
      panelSection(window, 'Size').getByTestId('duplicate-dot')
    ).toBeVisible({ timeout: 10_000 });
  });

  test('the user can still save after a duplicate-only external edit', async ({
    window,
    project,
  }) => {
    // The regression that killed the previous attempt at this. Updating
    // the duplicate metadata has to be recognised as "this came from
    // disk"; the attempt that flagged it wrong left the load flags set,
    // and every edit after it was treated as a load and never written.
    await expect(pageRoot(window)).toBeVisible();
    const className = await drawAndSelectRect(
      window,
      { x: 100, y: 100 },
      { x: 260, y: 200 }
    );
    await waitForSaved(window);

    const cssPath = path.join(project.dir, 'home.module.css');
    const original = await fs.readFile(cssPath, 'utf-8');
    const existingHeight = original
      .match(new RegExp(`\\.${className}\\s*\\{([^}]*)\\}`, 's'))?.[1]
      ?.match(/height:\s*[^;]+;/)?.[0];
    if (!existingHeight) throw new Error('no height to duplicate');
    await fs.writeFile(
      cssPath,
      original.replace(
        new RegExp(`(\\.${className}\\s*\\{)`),
        `$1\n  ${existingHeight}`
      ),
      'utf-8'
    );
    await expect(
      panelSection(window, 'Size').getByTestId('duplicate-dot')
    ).toBeVisible({ timeout: 10_000 });

    // Now edit through the panel — a path that does not depend on where
    // canvas keyboard focus landed after the reload — and require it to
    // reach disk.
    await commitInput(panelInputByPrefix(window, 'Size', 'W'), '321');
    await waitForSaved(window);
    await expect
      .poll(async () => await fs.readFile(cssPath, 'utf-8'))
      .toMatch(new RegExp(`\\.${className}[^}]*width:\\s*321px`, 's'));
  });

  test('editing a Size field clears the dot AND collapses the file', async ({
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

    const cssPath = path.join(project.dir, 'home.module.css');
    const original = await fs.readFile(cssPath, 'utf-8');
    await fs.writeFile(
      cssPath,
      original.replace(
        new RegExp(`(\\.${className}\\s*\\{[^}]*)\\}`),
        `$1  height: 100%;\n  height: 100vh;\n}`
      ),
      'utf-8'
    );

    const sizeSection = panelSection(window, 'Size');
    await expect(sizeSection.getByTestId('duplicate-dot')).toBeVisible({
      timeout: 10_000,
    });

    // Edit any size field — the typed-state-driven CSS rewrite drops
    // the duplicate. Type an explicit px value (the seeded duplicate ends
    // in `100vh`, so a bare number would now inherit the `vh` unit).
    const heightInput = panelInputByPrefix(window, 'Size', 'H');
    await commitInput(heightInput, '200px');
    await waitForSaved(window);

    // Indicator should clear optimistically AND on the next parse.
    await expect(sizeSection.getByTestId('duplicate-dot')).toHaveCount(0);

    const { css } = await readPageFiles(project.dir, project.pageName);
    const block = css.match(
      new RegExp(`\\.${className}\\s*\\{[^}]*\\}`, 's')
    )?.[0];
    expect(block).toBeDefined();
    // Word-boundary lookbehind so `min-height: …` doesn't match.
    const heightMatches = block!.match(/(?:^|\s)height:\s*[^;]+;/gm) ?? [];
    expect(heightMatches).toHaveLength(1);
    expect(heightMatches[0]?.trim()).toBe('height: 200px;');
  });
});
