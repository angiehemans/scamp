import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete';

/**
 * Custom CSS completion source for the properties panel.
 *
 * `@codemirror/lang-css` ships with a completion source, but it parses
 * the editor as a full CSS file. The properties panel only contains the
 * BODY of a single class block — naked declarations like
 *
 *     display: flex;
 *     gap: 16px;
 *
 * — so the parser sees the cursor "at the top level" and suggests
 * selectors (`body`, `div`, …) instead of property names.
 *
 * This source ignores parser context entirely and always offers:
 *   - property names when the cursor is before a `:` on the current line
 *   - values when the cursor is after a `:` on the current line, scoped
 *     to that specific property's known values
 *
 * The lists are the union of every property scamp can render natively
 * (so they appear first / are the most useful) plus a curated set of
 * common CSS properties that round-trip through `customProperties`.
 */

/** All CSS properties offered as completions, in display order. */
const CSS_PROPERTIES: ReadonlyArray<string> = [
  // Layout / sizing
  'display',
  'flex-direction',
  'align-items',
  'justify-content',
  'gap',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'padding',
  'margin',
  // Position
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'z-index',
  // Appearance
  'background',
  'background-color',
  'background-image',
  'border',
  'border-color',
  'border-radius',
  'border-style',
  'border-width',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'box-shadow',
  'opacity',
  'overflow',
  'overflow-x',
  'overflow-y',
  'cursor',
  // Text
  'color',
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  'text-align',
  'text-decoration',
  'text-transform',
  'white-space',
  // Effects
  'transform',
  'transition',
  'filter',
  'backdrop-filter',
  'animation',
];

/** Per-property value suggestions. Properties not listed here get no value hints. */
const CSS_VALUES_BY_PROPERTY: Readonly<Record<string, ReadonlyArray<string>>> = {
  display: ['flex', 'block', 'inline', 'inline-block', 'grid', 'inline-flex', 'none'],
  'flex-direction': ['row', 'column', 'row-reverse', 'column-reverse'],
  'align-items': ['flex-start', 'center', 'flex-end', 'stretch', 'baseline'],
  'justify-content': [
    'flex-start',
    'center',
    'flex-end',
    'space-between',
    'space-around',
    'space-evenly',
  ],
  position: ['relative', 'absolute', 'fixed', 'sticky', 'static'],
  width: ['100%', 'fit-content', 'auto', 'min-content', 'max-content'],
  height: ['100%', 'fit-content', 'auto', 'min-content', 'max-content'],
  'border-style': ['solid', 'dashed', 'dotted', 'double', 'none'],
  'text-align': ['left', 'center', 'right', 'justify'],
  'text-decoration': ['none', 'underline', 'line-through', 'overline'],
  'text-transform': ['none', 'uppercase', 'lowercase', 'capitalize'],
  'white-space': ['normal', 'nowrap', 'pre', 'pre-wrap', 'pre-line'],
  'font-weight': ['400', '500', '600', '700', 'normal', 'bold', 'lighter', 'bolder'],
  'font-style': ['normal', 'italic', 'oblique'],
  cursor: [
    'pointer',
    'default',
    'text',
    'move',
    'not-allowed',
    'grab',
    'grabbing',
    'crosshair',
    'wait',
  ],
  overflow: ['visible', 'hidden', 'scroll', 'auto'],
  'overflow-x': ['visible', 'hidden', 'scroll', 'auto'],
  'overflow-y': ['visible', 'hidden', 'scroll', 'auto'],
};

/**
 * Heuristic: are we typing a property name (before the colon) or a value
 * (after the colon) on the current line? We look at just the current line
 * because CSS declarations don't span lines in our editor.
 */
const splitCurrentLine = (
  context: CompletionContext
): { line: string; lineStart: number } => {
  const before = context.state.doc.sliceString(0, context.pos);
  const lastNewline = before.lastIndexOf('\n');
  const lineStart = lastNewline + 1;
  return { line: before.slice(lineStart), lineStart };
};

export const cssDeclarationsCompletion = (
  context: CompletionContext
): CompletionResult | null => {
  const { line } = splitCurrentLine(context);
  const colonIdx = line.indexOf(':');

  // VALUE completion — cursor is after a colon on the current line.
  if (colonIdx >= 0) {
    const propName = line.slice(0, colonIdx).trim().toLowerCase();
    const values = CSS_VALUES_BY_PROPERTY[propName];
    if (!values || values.length === 0) return null;
    const word = context.matchBefore(/[\w-%#]*/);
    if (!word) return null;
    if (word.from === word.to && !context.explicit) return null;
    return {
      from: word.from,
      options: values.map((v) => ({ label: v, type: 'keyword' })),
      validFor: /^[\w-%#]*$/,
    };
  }

  // PROPERTY completion — cursor is before any colon on the current line.
  const word = context.matchBefore(/[\w-]*/);
  if (!word) return null;
  if (word.from === word.to && !context.explicit) return null;
  return {
    from: word.from,
    options: CSS_PROPERTIES.map((p) => ({
      label: p,
      type: 'property',
      // Insert "prop: " so the user can immediately type the value and
      // get value-side completions on the next keystroke.
      apply: `${p}: `,
    })),
    validFor: /^[\w-]*$/,
  };
};
