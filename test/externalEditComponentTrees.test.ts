// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';

import { useCanvasStore } from '@store/canvasSlice';
import { makeFileChangedHandler } from '../src/renderer/src/syncBridge/externalEdit';

/**
 * `componentTrees` after an agent writes the file.
 *
 * It is what `scamp_check_view` and `scamp_get_view_props` answer from,
 * and it is built once, from `project.components`, when the project
 * loads. Nothing rebuilt it on an external edit — so both tools
 * reported on the parse from before the edit, byte-for-byte identical,
 * while the canvas beside them showed the new structure.
 *
 * A direct test rather than e2e because the staleness is invisible on
 * screen: the canvas is right and only the answer is wrong.
 */

const TSX_PATH = '/tmp/p/views/Card/Card.tsx';
const CSS_PATH = '/tmp/p/views/Card/Card.module.css';

const tsxWith = (label: string): string =>
  `import styles from './Card.module.css';\n\nexport default function Card() {\n  return (\n    <div data-scamp-id="root" className={styles.root}>\n      <p data-scamp-id="text_a1b2" className={styles.text_a1b2}>${label}</p>\n    </div>\n  );\n}\n`;
const CSS = '.root {\n  width: 100%;\n}\n\n.text_a1b2 {\n  color: red;\n}\n';

/**
 * Just enough `SaveContext` for the reload path. The quiet-window and
 * write-timer machinery is what the handler does about SAVING; this is
 * about what it does about READING, and stubbing them keeps the test
 * to the one behaviour.
 */
const ctx = {
  lastSerializedTsx: null,
  lastSerializedCss: null,
  canvasChangedDuringQuiet: false,
  quietWindow: { extend: (): void => {}, isOpen: (): boolean => false },
  cancelWriteTimer: (): void => {},
  scheduleQuietResume: (): void => {},
} as unknown as Parameters<typeof makeFileChangedHandler>[0];

const edit = (label: string): void => {
  makeFileChangedHandler(ctx)({
    path: TSX_PATH,
    tsxContent: tsxWith(label),
    cssContent: CSS,
  } as never);
};

const cardText = (): Array<string | undefined> =>
  Object.values(useCanvasStore.getState().componentTrees['Card']?.elements ?? {}).map(
    (e) => e.text
  );

describe('an external edit refreshes the trees the MCP answers from', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      projectPath: '/tmp/p',
      activePage: null,
      activeComponent: { name: 'Card', tsxPath: TSX_PATH, cssPath: CSS_PATH },
      componentTrees: {
        Card: { elements: {}, rootId: 'root', kind: 'view' },
      },
    } as never);
  });

  it('replaces the stale tree with the one just parsed', () => {
    edit('after the edit');
    expect(cardText()).toContain('after the edit');
  });

  it('keeps up when the agent writes twice', () => {
    edit('first');
    edit('second');
    expect(cardText()).toContain('second');
    expect(cardText()).not.toContain('first');
  });

  it('keeps the kind, so a view does not become a component', () => {
    edit('x');
    expect(useCanvasStore.getState().componentTrees['Card']?.kind).toBe('view');
    // And it really did run, rather than leaving the seed untouched.
    expect(cardText()).toContain('x');
  });

  it('leaves other components alone', () => {
    useCanvasStore.setState({
      componentTrees: {
        ...useCanvasStore.getState().componentTrees,
        Other: { elements: {}, rootId: 'root', kind: 'component' },
      },
    } as never);
    edit('x');
    expect(useCanvasStore.getState().componentTrees['Other']).toEqual({
      elements: {},
      rootId: 'root',
      kind: 'component',
    });
  });

  it('ignores a file that is not the active target', () => {
    makeFileChangedHandler(ctx)({
      path: '/tmp/p/views/Elsewhere/Elsewhere.tsx',
      tsxContent: tsxWith('not this one'),
      cssContent: CSS,
    } as never);
    expect(cardText()).not.toContain('not this one');
  });
});
