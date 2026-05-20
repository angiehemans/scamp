import { describe, it, expect, beforeEach } from 'vitest';
import { generateCode } from '@lib/generateCode';
import { parseCode } from '@lib/parseCode';
import { useCanvasStore } from '@store/canvasSlice';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
import { ROOT_ELEMENT_ID } from '@lib/element';
/**
 * Phase 5 coverage: the text-element `prop` field, plus the
 * generator + parser changes that round-trip it. The store-side
 * toggle/rename actions get a separate describe block; the
 * generator + parser get their own pair so a regression on one
 * side surfaces clearly.
 */
const makeRoot = (childIds = []) => ({
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
const makeText = (overrides) => ({
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
describe('canvas store — togglePropOnText', () => {
    beforeEach(() => {
        useCanvasStore.setState({
            elements: { [ROOT_ELEMENT_ID]: makeRoot([]) },
            rootElementId: ROOT_ELEMENT_ID,
            selectedElementIds: [],
        });
    });
    it('Locked → Prop assigns the lowest unused prop<N> default name', () => {
        useCanvasStore.setState({
            elements: {
                [ROOT_ELEMENT_ID]: makeRoot(['t1']),
                t1: makeText({ id: 't1' }),
            },
        });
        useCanvasStore.getState().togglePropOnText('t1');
        expect(useCanvasStore.getState().elements['t1'].prop).toBe('prop1');
    });
    it('picks prop2 when prop1 is already taken by another text element', () => {
        useCanvasStore.setState({
            elements: {
                [ROOT_ELEMENT_ID]: makeRoot(['t1', 't2']),
                t1: makeText({ id: 't1', prop: 'prop1' }),
                t2: makeText({ id: 't2' }),
            },
        });
        useCanvasStore.getState().togglePropOnText('t2');
        expect(useCanvasStore.getState().elements['t2'].prop).toBe('prop2');
    });
    it('Prop → Locked drops the `prop` field entirely', () => {
        useCanvasStore.setState({
            elements: {
                [ROOT_ELEMENT_ID]: makeRoot(['t1']),
                t1: makeText({ id: 't1', prop: 'label' }),
            },
        });
        useCanvasStore.getState().togglePropOnText('t1');
        expect(useCanvasStore.getState().elements['t1'].prop).toBeUndefined();
    });
    it('is a no-op on non-text elements', () => {
        useCanvasStore.setState({
            elements: {
                [ROOT_ELEMENT_ID]: makeRoot(['r1']),
                r1: { ...makeText({ id: 'r1' }), type: 'rectangle', text: undefined },
            },
        });
        useCanvasStore.getState().togglePropOnText('r1');
        expect(useCanvasStore.getState().elements['r1'].prop).toBeUndefined();
    });
});
describe('canvas store — renamePropOnText', () => {
    beforeEach(() => {
        useCanvasStore.setState({
            elements: {
                [ROOT_ELEMENT_ID]: makeRoot(['t1']),
                t1: makeText({ id: 't1', prop: 'prop1' }),
            },
            rootElementId: ROOT_ELEMENT_ID,
            selectedElementIds: [],
        });
    });
    it('updates the prop name on a text element with prop set', () => {
        useCanvasStore.getState().renamePropOnText('t1', 'label');
        expect(useCanvasStore.getState().elements['t1'].prop).toBe('label');
    });
    it('is a no-op for a text element without prop set', () => {
        useCanvasStore.setState({
            elements: {
                [ROOT_ELEMENT_ID]: makeRoot(['t1']),
                t1: makeText({ id: 't1' }),
            },
        });
        useCanvasStore.getState().renamePropOnText('t1', 'label');
        expect(useCanvasStore.getState().elements['t1'].prop).toBeUndefined();
    });
});
describe('generateCode — component props emission', () => {
    it('emits a Props type declaration when isComponent and a text-prop is set', () => {
        const { tsx } = generateCode({
            elements: {
                [ROOT_ELEMENT_ID]: makeRoot(['t1']),
                t1: makeText({ id: 't1', text: 'Click me', prop: 'label' }),
            },
            rootId: ROOT_ELEMENT_ID,
            pageName: 'Button',
            isComponent: true,
        });
        expect(tsx).toContain('type ButtonProps = {');
        expect(tsx).toContain('label?: string;');
    });
    it('emits the destructure with default value on the function signature', () => {
        const { tsx } = generateCode({
            elements: {
                [ROOT_ELEMENT_ID]: makeRoot(['t1']),
                t1: makeText({ id: 't1', text: 'Click me', prop: 'label' }),
            },
            rootId: ROOT_ELEMENT_ID,
            pageName: 'Button',
            isComponent: true,
        });
        expect(tsx).toContain('export default function Button({ label = "Click me" }: ButtonProps)');
    });
    it('emits {propName} JSX reference in place of the literal text', () => {
        const { tsx } = generateCode({
            elements: {
                [ROOT_ELEMENT_ID]: makeRoot(['t1']),
                t1: makeText({ id: 't1', text: 'Click me', prop: 'label' }),
            },
            rootId: ROOT_ELEMENT_ID,
            pageName: 'Button',
            isComponent: true,
        });
        expect(tsx).toContain('>{label}</p>');
        // Literal text should NOT appear inside the JSX body — it
        // lives only in the destructure default.
        expect(tsx).not.toMatch(/>Click me</);
    });
    it('emits the literal text and no Props type when isComponent=false (page)', () => {
        const { tsx } = generateCode({
            elements: {
                [ROOT_ELEMENT_ID]: makeRoot(['t1']),
                t1: makeText({ id: 't1', text: 'Click me', prop: 'label' }),
            },
            rootId: ROOT_ELEMENT_ID,
            pageName: 'home',
            // isComponent omitted — the field has no meaning on pages.
        });
        expect(tsx).not.toContain('type HomeProps');
        expect(tsx).toContain('>Click me</p>');
    });
    it('emits no Props type for a component with all-locked text descendants', () => {
        const { tsx } = generateCode({
            elements: {
                [ROOT_ELEMENT_ID]: makeRoot(['t1']),
                t1: makeText({ id: 't1', text: 'Hi' }),
            },
            rootId: ROOT_ELEMENT_ID,
            pageName: 'Button',
            isComponent: true,
        });
        expect(tsx).not.toContain('type ButtonProps');
        expect(tsx).toContain('export default function Button()');
        expect(tsx).toContain('>Hi</p>');
    });
    it('emits multiple props in destructure order', () => {
        const { tsx } = generateCode({
            elements: {
                [ROOT_ELEMENT_ID]: makeRoot(['t1', 't2']),
                t1: makeText({ id: 't1', text: 'Title', prop: 'title' }),
                t2: makeText({ id: 't2', text: 'Body', prop: 'body' }),
            },
            rootId: ROOT_ELEMENT_ID,
            pageName: 'Card',
            isComponent: true,
        });
        expect(tsx).toContain('title?: string;');
        expect(tsx).toContain('body?: string;');
        expect(tsx).toContain('export default function Card({ title = "Title", body = "Body" }: CardProps)');
    });
    it('escapes double-quotes and backslashes in the default-text literal', () => {
        const { tsx } = generateCode({
            elements: {
                [ROOT_ELEMENT_ID]: makeRoot(['t1']),
                t1: makeText({
                    id: 't1',
                    text: 'She said "hi" \\backslash',
                    prop: 'label',
                }),
            },
            rootId: ROOT_ELEMENT_ID,
            pageName: 'Quote',
            isComponent: true,
        });
        expect(tsx).toContain('label = "She said \\"hi\\" \\\\backslash"');
    });
});
describe('parseCode — text prop hydration', () => {
    it('reads {propName} JSX body + destructure default into prop + text', () => {
        const tsx = `import styles from './Button.module.css';

type ButtonProps = {
  label?: string;
};

export default function Button({ label = "Click me" }: ButtonProps) {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <p data-scamp-id="text_t1" className={styles.text_t1}>{label}</p>
    </div>
  );
}
`;
        const css = `.root {\n}\n\n.text_t1 {\n}\n`;
        const parsed = parseCode(tsx, css);
        const text = parsed.elements['t1'];
        expect(text).toBeDefined();
        expect(text.type).toBe('text');
        expect(text.prop).toBe('label');
        expect(text.text).toBe('Click me');
    });
    it('leaves unresolved JSX expressions as literal text (no destructure entry)', () => {
        // `{notAProp}` doesn't appear in the destructure, so we keep
        // the literal text so the round-trip round-trips and the user
        // sees the unexpected reference rather than silently losing it.
        const tsx = `import styles from './Foo.module.css';

export default function Foo() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <p data-scamp-id="text_t1" className={styles.text_t1}>{notAProp}</p>
    </div>
  );
}
`;
        const css = `.root {\n}\n\n.text_t1 {\n}\n`;
        const parsed = parseCode(tsx, css);
        const text = parsed.elements['t1'];
        expect(text.prop).toBeUndefined();
        expect(text.text).toBe('{notAProp}');
    });
    it('decodes escaped quotes and backslashes from the destructure default', () => {
        const tsx = `import styles from './Quote.module.css';

type QuoteProps = {
  label?: string;
};

export default function Quote({ label = "She said \\"hi\\" \\\\back" }: QuoteProps) {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <p data-scamp-id="text_t1" className={styles.text_t1}>{label}</p>
    </div>
  );
}
`;
        const css = `.root {\n}\n\n.text_t1 {\n}\n`;
        const parsed = parseCode(tsx, css);
        expect(parsed.elements['t1'].text).toBe('She said "hi" \\back');
    });
});
describe('generateCode → parseCode round-trip (component with mixed text)', () => {
    it('round-trips a component with one prop text and one locked text', () => {
        const original = {
            [ROOT_ELEMENT_ID]: makeRoot(['t1', 't2']),
            t1: makeText({ id: 't1', text: 'Click me', prop: 'label' }),
            t2: makeText({ id: 't2', text: 'Static caption' }),
        };
        const { tsx, css } = generateCode({
            elements: original,
            rootId: ROOT_ELEMENT_ID,
            pageName: 'Button',
            isComponent: true,
        });
        const parsed = parseCode(tsx, css);
        expect(parsed.elements['t1'].prop).toBe('label');
        expect(parsed.elements['t1'].text).toBe('Click me');
        expect(parsed.elements['t2'].prop).toBeUndefined();
        expect(parsed.elements['t2'].text).toBe('Static caption');
    });
});
