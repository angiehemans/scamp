import { describe, it, expect } from 'vitest';
import { generateCode } from '@lib/generateCode';
import { parseCode } from '@lib/parseCode';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
import { ROOT_ELEMENT_ID, type ScampElement } from '@lib/element';

const makeRoot = (childIds: string[] = []): ScampElement => ({
  ...DEFAULT_RECT_STYLES,
  id: ROOT_ELEMENT_ID,
  type: 'rectangle',
  parentId: null,
  childIds,
  widthMode: 'stretch',
  heightMode: 'auto',
  minHeight: '100vh',
  x: 0,
  y: 0,
  customProperties: {},
});

const makeRect = (
  overrides: Partial<ScampElement> & { id: string }
): ScampElement => ({
  ...DEFAULT_RECT_STYLES,
  type: 'rectangle',
  parentId: ROOT_ELEMENT_ID,
  childIds: [],
  x: 0,
  y: 0,
  customProperties: {},
  ...overrides,
});

describe('generateCode — positioning context for absolute descendants', () => {
  it('emits position: relative on a flex child that contains an absolute element', () => {
    // Scenario from the bug report: case_media is a flex child (its
    // parent .case row is `display: flex`). Without intervention,
    // case_media has no `position` declaration and its inner img with
    // `position: absolute` escapes to .root.
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['row1']),
      row1: makeRect({
        id: 'row1',
        parentId: ROOT_ELEMENT_ID,
        childIds: ['media'],
        display: 'flex',
      }),
      media: makeRect({
        id: 'media',
        parentId: 'row1',
        childIds: ['img1'],
      }),
      img1: makeRect({
        id: 'img1',
        parentId: 'media',
        type: 'image',
        position: 'absolute',
        x: 0,
        y: 0,
      }),
    };
    const { css } = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
    });
    const mediaBlock = extractBlock(css, '.rect_media');
    expect(mediaBlock).toContain('position: relative;');
    expect(mediaBlock).toContain('left: 0px;');
    expect(mediaBlock).toContain('top: 0px;');
  });

  it('does NOT emit position: relative on a flex child whose descendants are all flex-placed', () => {
    // Normal flex layout: the parent of an inner flex container
    // shouldn't gain a positioning context just because it has
    // children — only when those children would be absolute.
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['row1']),
      row1: makeRect({
        id: 'row1',
        parentId: ROOT_ELEMENT_ID,
        childIds: ['col1'],
        display: 'flex',
      }),
      col1: makeRect({
        id: 'col1',
        parentId: 'row1',
        childIds: ['textbox'],
        display: 'flex',
      }),
      textbox: makeRect({
        id: 'textbox',
        parentId: 'col1',
      }),
    };
    const { css } = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
    });
    const colBlock = extractBlock(css, '.rect_col1');
    expect(colBlock).not.toContain('position: relative;');
  });

  it('round-trips through parseCode without text drift after two saves', () => {
    // First generate writes position: relative on the parent.
    // parseCode reads it back as `position: 'relative'`. The next
    // generate should produce byte-identical CSS.
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['row1']),
      row1: makeRect({
        id: 'row1',
        parentId: ROOT_ELEMENT_ID,
        childIds: ['media'],
        display: 'flex',
      }),
      media: makeRect({
        id: 'media',
        parentId: 'row1',
        childIds: ['img1'],
      }),
      img1: makeRect({
        id: 'img1',
        parentId: 'media',
        type: 'image',
        position: 'absolute',
        x: 0,
        y: 0,
      }),
    };
    const first = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
    });
    const parsed = parseCode(first.tsx, first.css);
    const second = generateCode({
      elements: parsed.elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
    });
    expect(second.css).toBe(first.css);
  });

  it('handles a non-flex parent whose auto-child becomes absolute', () => {
    // Non-flex parent + auto child → generator emits absolute on
    // child (Scamp's free-form fallback). Parent needs relative too.
    // This case was already handled by the original non-root-non-
    // layout-parent branch, but verify the new code path doesn't
    // double-emit.
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['box']),
      box: makeRect({
        id: 'box',
        parentId: ROOT_ELEMENT_ID,
        childIds: ['inner'],
        // no display: flex — free-form container
      }),
      inner: makeRect({
        id: 'inner',
        parentId: 'box',
        // position: 'auto' default
      }),
    };
    const { css } = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
    });
    // `.rect_box` is itself a non-root non-layout-parent child of
    // root, so it gets `position: absolute` via the original branch.
    // That already establishes a positioning context — no extra
    // `position: relative` needed.
    const boxBlock = extractBlock(css, '.rect_box');
    const positionDecls = boxBlock
      .split('\n')
      .filter((l) => l.trim().startsWith('position:'));
    expect(positionDecls).toHaveLength(1);
    expect(positionDecls[0]).toContain('absolute');
  });
});

const extractBlock = (css: string, selector: string): string => {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`block ${selector} not found in css`);
  const end = css.indexOf('}', start);
  if (end === -1) throw new Error(`block ${selector} not terminated`);
  return css.slice(start, end + 1);
};
