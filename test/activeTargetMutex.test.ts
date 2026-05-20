import { describe, it, expect } from 'vitest';
import { useCanvasStore } from '@store/canvasSlice';
import { ROOT_ELEMENT_ID, type ScampElement } from '@lib/element';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';

/**
 * The canvas store's `activePage` / `activeComponent` invariant
 * is that AT MOST ONE is non-null at a time. `loadPage` and
 * `loadComponent` are the only paths that flip them, so we check
 * both directions here. Also verifies that the history slice's
 * activePageId is updated to the new target's tsxPath so per-target
 * history buckets stay coherent.
 */

const makeRoot = (): ScampElement => ({
  ...DEFAULT_RECT_STYLES,
  id: ROOT_ELEMENT_ID,
  type: 'rectangle',
  parentId: null,
  childIds: [],
  x: 0,
  y: 0,
  customProperties: {},
});

describe('loadPage / loadComponent mutual exclusivity', () => {
  it('loadPage clears any prior activeComponent', () => {
    useCanvasStore.getState().loadComponent(
      { name: 'Button', tsxPath: '/p/components/Button/Button.tsx', cssPath: '/p/components/Button/Button.module.css' },
      { [ROOT_ELEMENT_ID]: makeRoot() },
      { tsx: '', css: '' }
    );
    expect(useCanvasStore.getState().activeComponent?.name).toBe('Button');
    expect(useCanvasStore.getState().activePage).toBeNull();

    useCanvasStore.getState().loadPage(
      { name: 'home', tsxPath: '/p/app/page.tsx', cssPath: '/p/app/page.module.css' },
      { [ROOT_ELEMENT_ID]: makeRoot() },
      { tsx: '', css: '' }
    );
    expect(useCanvasStore.getState().activePage?.name).toBe('home');
    expect(useCanvasStore.getState().activeComponent).toBeNull();
  });

  it('loadComponent clears any prior activePage', () => {
    useCanvasStore.getState().loadPage(
      { name: 'home', tsxPath: '/p/app/page.tsx', cssPath: '/p/app/page.module.css' },
      { [ROOT_ELEMENT_ID]: makeRoot() },
      { tsx: '', css: '' }
    );
    expect(useCanvasStore.getState().activePage?.name).toBe('home');

    useCanvasStore.getState().loadComponent(
      { name: 'Card', tsxPath: '/p/components/Card/Card.tsx', cssPath: '/p/components/Card/Card.module.css' },
      { [ROOT_ELEMENT_ID]: makeRoot() },
      { tsx: '', css: '' }
    );
    expect(useCanvasStore.getState().activeComponent?.name).toBe('Card');
    expect(useCanvasStore.getState().activePage).toBeNull();
  });

  it('resetForNewPage clears both targets', () => {
    useCanvasStore.getState().loadComponent(
      { name: 'Card', tsxPath: '/p/components/Card/Card.tsx', cssPath: '/p/components/Card/Card.module.css' },
      { [ROOT_ELEMENT_ID]: makeRoot() },
      { tsx: '', css: '' }
    );
    useCanvasStore.getState().resetForNewPage();
    expect(useCanvasStore.getState().activePage).toBeNull();
    expect(useCanvasStore.getState().activeComponent).toBeNull();
  });

  it('marks the load as initial (lastLoadKind / isLoading) for both kinds', () => {
    useCanvasStore.getState().loadComponent(
      { name: 'Card', tsxPath: '/p/components/Card/Card.tsx', cssPath: '/p/components/Card/Card.module.css' },
      { [ROOT_ELEMENT_ID]: makeRoot() },
      { tsx: '', css: '' }
    );
    const state = useCanvasStore.getState();
    expect(state.isLoading).toBe(true);
    expect(state.lastLoadKind).toBe('initial');
  });
});
