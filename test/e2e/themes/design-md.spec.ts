import { promises as fs } from 'fs';
import * as path from 'path';

import { test, expect } from '../fixtures/app';
import { pageRoot } from '../fixtures/selectors';

test.use({ projectOptions: { format: 'nextjs' } });

const readDesignMd = async (dir: string): Promise<string> => {
  try {
    return await fs.readFile(path.join(dir, 'DESIGN.md'), 'utf-8');
  } catch {
    return '';
  }
};

test.describe('themes: DESIGN.md generation', () => {
  test('generates DESIGN.md from the theme tokens on project open', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();

    await expect
      .poll(async () => readDesignMd(project.dir), { timeout: 8_000 })
      .toContain('primary: "{colors.brand-500}"');

    const md = await readDesignMd(project.dir);
    // YAML front matter with the auto-generated colours.
    expect(md).toMatch(/^---\n/);
    expect(md).toContain('name:');
    expect(md).toContain('colors:');
    expect(md).toContain('brand-500: "#3b82f6"');
  });

  test('regenerates token YAML while preserving authored prose', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    // Wait for the initial generation.
    await expect
      .poll(async () => readDesignMd(project.dir), { timeout: 8_000 })
      .toContain('colors:');

    // Author prose + a description directly in the file (no token YAML).
    await fs.writeFile(
      path.join(project.dir, 'DESIGN.md'),
      `---
name: My App
description: My design system.
---

## Overview

Hand-written overview notes.
`,
      'utf-8'
    );

    // A token change triggers a regeneration that must keep the prose.
    await window.locator('[data-section="design-system"]').click();
    await window
      .getByTestId('theme-panel')
      .getByTestId('add-default-spacing')
      .click();

    await expect
      .poll(async () => readDesignMd(project.dir), { timeout: 8_000 })
      .toContain('4: 16px'); // spacing YAML regenerated

    const md = await readDesignMd(project.dir);
    expect(md).toContain('description: My design system.');
    expect(md).toContain('## Overview');
    expect(md).toContain('Hand-written overview notes.');
    expect(md).toContain('colors:'); // token YAML restored from theme.css
  });

  test('editing a Documentation form field writes prose to DESIGN.md', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await window.locator('[data-section="design-system"]').click();
    const panel = window.getByTestId('theme-panel');
    await expect(panel).toBeVisible();
    await expect
      .poll(async () => readDesignMd(project.dir), { timeout: 8_000 })
      .toContain('colors:');

    const colors = panel.locator('[data-design-doc-section="Colors"]');
    await colors.fill('Use brand sparingly.');
    await colors.blur();

    await expect
      .poll(async () => readDesignMd(project.dir), { timeout: 8_000 })
      .toContain('## Colors\n\nUse brand sparingly.');
  });

  test('an external DESIGN.md edit populates the Documentation forms', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await window.locator('[data-section="design-system"]').click();
    const panel = window.getByTestId('theme-panel');
    await expect
      .poll(async () => readDesignMd(project.dir), { timeout: 8_000 })
      .toContain('colors:');

    await fs.writeFile(
      path.join(project.dir, 'DESIGN.md'),
      `---
name: Portfolio
---

## Layout

Grid guidance from an agent.
`,
      'utf-8'
    );

    await expect(panel.getByTestId('design-doc-name')).toHaveValue('Portfolio');
    await expect(
      panel.locator('[data-design-doc-section="Layout"]')
    ).toHaveValue('Grid guidance from an agent.');
  });
});
