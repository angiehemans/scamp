import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { generateCode } from '@lib/generateCode';
import { parseCode } from '@lib/parseCode';
import { patchClassBlock } from '@shared/patchClass';
import { ROOT_ELEMENT_ID, type ScampElement } from '@lib/element';

import { makeRect, makeRoot } from './fixtures/elements';

/**
 * Simulates an external agent editing a CSS module file:
 *  1. Generate canonical files for a tree
 *  2. Mutate the CSS on disk via the same `patchClassBlock` an agent would
 *     conceptually do (or via raw file write)
 *  3. Re-read + parseCode
 *  4. Assert the changed property is reflected in state and nothing else
 *     was disturbed
 */
describe('external edit integration', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scamp-extedit-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('reflects an agent-style background-color change in the parsed tree', async () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2', 'c3d4']),
      a1b2: makeRect({
        id: 'a1b2',
        x: 100,
        y: 50,
        widthValue: 400,
        heightValue: 300,
        backgroundColor: '#f0f0f0',
        borderRadius: [8, 8, 8, 8],
      }),
      c3d4: makeRect({
        id: 'c3d4',
        x: 20,
        y: 30,
        widthValue: 100,
        heightValue: 100,
        backgroundColor: '#3b82f6',
      }),
    };

    const { tsx, css } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    const tsxPath = path.join(tmpDir, 'home.tsx');
    const cssPath = path.join(tmpDir, 'home.module.css');
    await fs.writeFile(tsxPath, tsx, 'utf-8');
    await fs.writeFile(cssPath, css, 'utf-8');

    // Read back the CSS, build the new declaration body for rect_a1b2 by
    // replacing only the background line, then patch it through.
    const cssOnDisk = await fs.readFile(cssPath, 'utf-8');
    const newDeclarations = `
      width: 400px;
      height: 300px;
      background: red;
      border-radius: 8px;
      position: absolute;
      left: 100px;
      top: 50px;
    `;
    const patched = patchClassBlock(cssOnDisk, 'rect_a1b2', newDeclarations);
    await fs.writeFile(cssPath, patched, 'utf-8');

    const tsxAfter = await fs.readFile(tsxPath, 'utf-8');
    const cssAfter = await fs.readFile(cssPath, 'utf-8');
    const parsed = parseCode(tsxAfter, cssAfter);

    // The targeted element changed
    const a = parsed.elements['a1b2'];
    expect(a?.backgroundColor).toBe('red');
    // Other properties on the same element are intact
    expect(a?.widthValue).toBe(400);
    expect(a?.heightValue).toBe(300);
    expect(a?.borderRadius).toEqual([8, 8, 8, 8]);
    expect(a?.x).toBe(100);
    expect(a?.y).toBe(50);

    // Sibling element is untouched
    const c = parsed.elements['c3d4'];
    expect(c?.backgroundColor).toBe('#3b82f6');
    expect(c?.widthValue).toBe(100);
    expect(c?.x).toBe(20);
    expect(c?.y).toBe(30);

    // Tree shape preserved
    expect(parsed.elements[ROOT_ELEMENT_ID]?.childIds).toEqual(['a1b2', 'c3d4']);
  });

  it('preserves an agent-added unmapped property as customProperties', async () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({
        id: 'a1b2',
        widthValue: 200,
        heightValue: 200,
        backgroundColor: '#222',
      }),
    };

    const { tsx, css } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    const tsxPath = path.join(tmpDir, 'home.tsx');
    const cssPath = path.join(tmpDir, 'home.module.css');
    await fs.writeFile(tsxPath, tsx, 'utf-8');
    await fs.writeFile(cssPath, css, 'utf-8');

    const cssOnDisk = await fs.readFile(cssPath, 'utf-8');
    const newDeclarations = `
      width: 200px;
      height: 200px;
      background: #222;
      clip-path: circle(40%);
      position: absolute;
      left: 0;
      top: 0;
    `;
    const patched = patchClassBlock(cssOnDisk, 'rect_a1b2', newDeclarations);
    await fs.writeFile(cssPath, patched, 'utf-8');

    const parsed = parseCode(
      await fs.readFile(tsxPath, 'utf-8'),
      await fs.readFile(cssPath, 'utf-8')
    );
    expect(parsed.elements['a1b2']?.customProperties).toEqual({
      'clip-path': 'circle(40%)',
    });
    // The mapped properties still applied
    expect(parsed.elements['a1b2']?.backgroundColor).toBe('#222');
    expect(parsed.elements['a1b2']?.widthValue).toBe(200);
  });
});
