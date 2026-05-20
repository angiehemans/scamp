import { describe, it, expect, beforeEach } from 'vitest';
import {
  rewriteComponentForRename,
  rewritePageForComponentRename,
} from '@lib/componentRename';
import { generateCode } from '@lib/generateCode';
import { parseCode } from '@lib/parseCode';
import { useCanvasStore } from '@store/canvasSlice';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
import { ROOT_ELEMENT_ID, type ScampElement } from '@lib/element';

/**
 * Phase 7.2 coverage: component rename. Helpers are pure
 * functions so they get unit-tested directly; the
 * `renameComponentReferences` store action gets its own
 * describe block.
 */

const makePageRoot = (childIds: string[] = []): ScampElement => ({
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
  backgroundColor: '#ffffff',
  customProperties: {},
});

const makeText = (
  overrides: Partial<ScampElement> & { id: string }
): ScampElement => ({
  ...DEFAULT_RECT_STYLES,
  type: 'text',
  parentId: ROOT_ELEMENT_ID,
  childIds: [],
  x: 0,
  y: 0,
  customProperties: {},
  text: 'hello',
  ...overrides,
});

const makeInstance = (
  overrides: Partial<ScampElement> & { id: string; componentName: string }
): ScampElement => ({
  ...DEFAULT_RECT_STYLES,
  type: 'component-instance',
  parentId: ROOT_ELEMENT_ID,
  childIds: [],
  widthMode: 'auto',
  heightMode: 'auto',
  x: 0,
  y: 0,
  customProperties: {},
  instanceId: `inst_${overrides.id}`,
  propOverrides: {},
  ...overrides,
});

describe('rewriteComponentForRename', () => {
  it('updates the function name + CSS module import basename', () => {
    const original = generateCode({
      elements: {
        [ROOT_ELEMENT_ID]: makePageRoot([]),
      },
      rootId: ROOT_ELEMENT_ID,
      pageName: 'Button',
      cssModuleImportName: 'Button',
      isComponent: true,
    });
    const renamed = rewriteComponentForRename(
      original.tsx,
      original.css,
      'Button',
      'PrimaryButton'
    );
    expect(renamed.tsx).toContain(
      "import styles from './PrimaryButton.module.css';"
    );
    expect(renamed.tsx).toContain('export default function PrimaryButton(');
    expect(renamed.tsx).not.toContain('function Button(');
  });

  it('renames the Props type when the component has prop-text', () => {
    const original = generateCode({
      elements: {
        [ROOT_ELEMENT_ID]: makePageRoot(['t1']),
        t1: makeText({ id: 't1', text: 'Click me', prop: 'label' }),
      },
      rootId: ROOT_ELEMENT_ID,
      pageName: 'Button',
      cssModuleImportName: 'Button',
      isComponent: true,
    });
    expect(original.tsx).toContain('type ButtonProps = {');
    const renamed = rewriteComponentForRename(
      original.tsx,
      original.css,
      'Button',
      'CallToAction'
    );
    expect(renamed.tsx).toContain('type CallToActionProps = {');
    expect(renamed.tsx).toContain(
      'export default function CallToAction({ label = "Click me" }: CallToActionProps)'
    );
    expect(renamed.tsx).not.toContain('ButtonProps');
  });

  it('preserves the element tree and default values after rename', () => {
    const original = generateCode({
      elements: {
        [ROOT_ELEMENT_ID]: makePageRoot(['t1']),
        t1: makeText({ id: 't1', text: 'Original default', prop: 'label' }),
      },
      rootId: ROOT_ELEMENT_ID,
      pageName: 'Button',
      cssModuleImportName: 'Button',
      isComponent: true,
    });
    const renamed = rewriteComponentForRename(
      original.tsx,
      original.css,
      'Button',
      'NewName'
    );
    const reparsed = parseCode(renamed.tsx, renamed.css);
    // The text element survives + its default value is intact.
    const propTexts = Object.values(reparsed.elements).filter(
      (el) => el.type === 'text' && typeof el.prop === 'string'
    );
    expect(propTexts.length).toBe(1);
    expect(propTexts[0]!.text).toBe('Original default');
    expect(propTexts[0]!.prop).toBe('label');
  });
});

describe('rewritePageForComponentRename', () => {
  const buildPage = (componentNames: string[]): { tsx: string; css: string } => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makePageRoot(componentNames.map((_, i) => `i${i}`)),
    };
    componentNames.forEach((name, i) => {
      elements[`i${i}`] = makeInstance({
        id: `i${i}`,
        componentName: name,
      });
    });
    return generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
    });
  };

  it('returns changed: false when the page does not reference oldName', () => {
    const page = buildPage(['Other']);
    const out = rewritePageForComponentRename(
      page.tsx,
      page.css,
      'Button',
      'PrimaryButton',
      'home',
      'legacy'
    );
    expect(out.changed).toBe(false);
    expect(out.tsx).toBe(page.tsx);
    expect(out.css).toBe(page.css);
  });

  it('rewrites the import + JSX tag when the page does reference oldName', () => {
    const page = buildPage(['Button']);
    const out = rewritePageForComponentRename(
      page.tsx,
      page.css,
      'Button',
      'PrimaryButton',
      'home',
      'legacy'
    );
    expect(out.changed).toBe(true);
    expect(out.tsx).toContain("import PrimaryButton from '@/components/PrimaryButton/PrimaryButton';");
    expect(out.tsx).toContain('<PrimaryButton');
    expect(out.tsx).not.toContain('<Button');
    expect(out.tsx).not.toContain(
      "import Button from '@/components/Button/Button';"
    );
  });

  it('leaves unrelated instances alone in the same page', () => {
    const page = buildPage(['Button', 'Card']);
    const out = rewritePageForComponentRename(
      page.tsx,
      page.css,
      'Button',
      'PrimaryButton',
      'home',
      'legacy'
    );
    expect(out.changed).toBe(true);
    expect(out.tsx).toContain('<PrimaryButton');
    expect(out.tsx).toContain('<Card');
    expect(out.tsx).not.toContain('<Button');
  });
});

describe('canvas store — renameComponentReferences', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      elements: {
        [ROOT_ELEMENT_ID]: makePageRoot(['i1', 'i2']),
        i1: makeInstance({ id: 'i1', componentName: 'Button' }),
        i2: makeInstance({ id: 'i2', componentName: 'Card' }),
      },
      rootElementId: ROOT_ELEMENT_ID,
      selectedElementIds: [],
      editingInstanceProp: null,
    });
  });

  it('renames every matching component-instance', () => {
    useCanvasStore.getState().renameComponentReferences('Button', 'PrimaryButton');
    const state = useCanvasStore.getState();
    expect(state.elements['i1']!.componentName).toBe('PrimaryButton');
    expect(state.elements['i2']!.componentName).toBe('Card');
  });

  it('is a no-op when oldName === newName', () => {
    const before = useCanvasStore.getState().elements;
    useCanvasStore.getState().renameComponentReferences('Button', 'Button');
    expect(useCanvasStore.getState().elements).toBe(before);
  });

  it('clears editingInstanceProp when its instance is being renamed', () => {
    useCanvasStore.setState({
      editingInstanceProp: { instanceId: 'i1', propName: 'label' },
    });
    useCanvasStore.getState().renameComponentReferences('Button', 'NewName');
    expect(useCanvasStore.getState().editingInstanceProp).toBeNull();
  });

  it('keeps editingInstanceProp when targeting a non-renamed instance', () => {
    useCanvasStore.setState({
      editingInstanceProp: { instanceId: 'i2', propName: 'label' },
    });
    useCanvasStore.getState().renameComponentReferences('Button', 'NewName');
    expect(useCanvasStore.getState().editingInstanceProp).toEqual({
      instanceId: 'i2',
      propName: 'label',
    });
  });
});
