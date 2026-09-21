// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import type { ComponentFile, PageFile, ProjectData } from '@shared/types';
import { useComponentManagement } from '@renderer/src/components/projectShell/useComponentManagement';

/**
 * The migration's convert-every-page loop, at the one point an
 * end-to-end test can't pin: the ordering.
 *
 * Converting a page replaces its files with a one-line wrapper and
 * deletes its stylesheet. A canvas still pointed at them reloads from
 * the wrapper, comes back empty, and writes that empty canvas out as a
 * page again — which left the Next.js → Scamp migration refusing to
 * run, because the page it had just converted was still a page. The
 * loop has to move the canvas off first.
 *
 * That is a race, and a race is what an e2e can't hold still: the
 * fixture project is small enough that the write always settles before
 * the conversion starts, so the migration specs pass with or without
 * the fix. This asserts the ordering directly instead.
 * see docs/notes/routes-in-the-app.md
 */

const PAGE_TSX = `import styles from './page.module.css';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root} />
  );
}
`;
const PAGE_CSS = `.root {
  width: 100%;
  min-height: 100vh;
  position: relative;
}
`;

const page = (name: string): PageFile => ({
  name,
  tsxPath: `/p/app/${name}/page.tsx`,
  cssPath: `/p/app/${name}/page.module.css`,
  tsxContent: PAGE_TSX,
  cssContent: PAGE_CSS,
});

const project = (pages: PageFile[]): ProjectData =>
  ({
    name: 'p',
    path: '/p',
    format: 'nextjs',
    pages,
    components: [],
  }) as unknown as ProjectData;

const view = (name: string): ComponentFile =>
  ({
    name,
    kind: 'view',
    tsxPath: `/p/views/${name}/${name}.tsx`,
    cssPath: `/p/views/${name}/${name}.module.css`,
    tsxContent: '',
    cssContent: '',
  }) as unknown as ComponentFile;

/** Every call the conversion makes, in the order it makes them. */
let calls: string[] = [];

const stubScampApi = (): void => {
  const api = {
    createSnapshot: vi.fn(async () => ({ snapshot: { id: 's1' } })),
    createComponent: vi.fn(async (args: { componentName: string }) => {
      calls.push(`createComponent:${args.componentName}`);
      return view(args.componentName);
    }),
  };
  (globalThis as { window: Window }).window.scamp =
    api as unknown as Window['scamp'];
};

const harness = (pages: PageFile[]) => {
  const setActivePageName = vi.fn((next: string | null) => {
    calls.push(`setActivePageName:${String(next)}`);
  });
  const rendered = renderHook(() =>
    useComponentManagement({
      project: project(pages),
      onProjectChange: vi.fn(),
      activeComponent: null,
      setActiveComponentState: vi.fn(),
      activePageName: 'home',
      setActivePageName,
      openComponent: vi.fn(),
      persistActiveSource: vi.fn(),
    })
  );
  return { rendered, setActivePageName };
};

describe('convertAllPagesToViews', () => {
  beforeEach(() => {
    calls = [];
    stubScampApi();
  });

  it('moves the canvas off the open page before it converts anything', async () => {
    const { rendered, setActivePageName } = harness([page('home')]);

    await act(async () => {
      await rendered.result.current.convertAllPagesToViews();
    });

    expect(setActivePageName).toHaveBeenCalledWith(null);
    // The ordering is the whole point: a canvas still pointed at the
    // page writes it back the moment the conversion replaces its files.
    expect(calls[0]).toBe('setActivePageName:null');
    expect(calls).toContain('createComponent:Home');
    expect(calls.indexOf('setActivePageName:null')).toBeLessThan(
      calls.indexOf('createComponent:Home')
    );
  });

  it('converts every page, in order', async () => {
    const { rendered } = harness([page('home'), page('about')]);

    await act(async () => {
      await rendered.result.current.convertAllPagesToViews();
    });

    expect(calls).toEqual([
      'setActivePageName:null',
      'createComponent:Home',
      'createComponent:About',
    ]);
  });

  it('leaves the canvas alone when no page is open', async () => {
    const setActivePageName = vi.fn();
    const rendered = renderHook(() =>
      useComponentManagement({
        project: project([page('home')]),
        onProjectChange: vi.fn(),
        activeComponent: null,
        setActiveComponentState: vi.fn(),
        activePageName: null,
        setActivePageName,
        openComponent: vi.fn(),
        persistActiveSource: vi.fn(),
      })
    );

    await act(async () => {
      await rendered.result.current.convertAllPagesToViews();
    });

    expect(setActivePageName).not.toHaveBeenCalled();
  });
});
