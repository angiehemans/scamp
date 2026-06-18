// store/canvas/factories.ts — pure element factories, split from canvasSlice.ts (5.1).
import { ROOT_ELEMENT_ID } from '@lib/element';
import { DEFAULT_RECT_STYLES, DEFAULT_ROOT_STYLES } from '@lib/defaults';
import { DEFAULT_BODY_FONT_FAMILY } from '@shared/agentMd';
export const makeRootElement = () => ({
    ...DEFAULT_ROOT_STYLES,
    id: ROOT_ELEMENT_ID,
    type: 'rectangle',
    parentId: null,
    childIds: [],
    widthMode: 'fixed',
    heightMode: 'fixed',
    x: 0,
    y: 0,
    customProperties: {},
});
/**
 * Default fill color for any rectangle created via the canvas tool. We
 * deliberately override `DEFAULT_RECT_STYLES.backgroundColor` (transparent)
 * here because a transparent rect on the white page frame is invisible —
 * the user just sees their click do nothing. Light grey is visible and
 * still neutral enough that the user can recolor it from the panel.
 */
export const NEW_RECT_BACKGROUND = '#e5e5e5';
export const makeRectangle = (input, id) => ({
    ...DEFAULT_RECT_STYLES,
    id,
    type: 'rectangle',
    parentId: input.parentId,
    childIds: [],
    x: input.x,
    y: input.y,
    widthValue: input.width,
    heightValue: input.height,
    backgroundColor: NEW_RECT_BACKGROUND,
    customProperties: {},
});
export const TEXT_DEFAULT_WIDTH = 120;
export const TEXT_DEFAULT_HEIGHT = 24;
export const makeText = (input, id, fontFamily) => ({
    ...DEFAULT_RECT_STYLES,
    id,
    type: 'text',
    parentId: input.parentId,
    childIds: [],
    x: input.x,
    y: input.y,
    // Text elements default to "hug" sizing on both axes so the box
    // grows / shrinks with the text content. Changing the font size
    // from the panel reflows the box automatically — no clipped
    // descenders or trapped whitespace. The numeric fallbacks stay
    // around so switching to a fixed mode from the panel has a
    // sensible starting value rather than 0.
    widthMode: 'fit-content',
    widthValue: TEXT_DEFAULT_WIDTH,
    heightMode: 'fit-content',
    heightValue: TEXT_DEFAULT_HEIGHT,
    customProperties: {},
    text: input.text ?? 'Text',
    fontFamily,
    fontSize: '14px',
    fontWeight: 400,
    color: '#222222',
    textAlign: 'left',
});
/**
 * Pick the default `font-family` for a freshly-created text element.
 * Prefers the project's `--font-sans` token (so new text inherits the
 * project's chosen default font), falling back to the literal system
 * font stack when the token isn't declared. Setting an explicit value
 * — rather than relying on body-level inheritance — makes the
 * Typography section reflect "Sans" as the current font, gives the
 * user a clear surface to override per-element, and keeps the
 * generated CSS self-documenting.
 */
export const defaultTextFontFamily = (themeTokens) => {
    const fontSans = themeTokens.find((t) => t.name === '--font-sans');
    if (fontSans)
        return 'var(--font-sans)';
    return DEFAULT_BODY_FONT_FAMILY;
};
export const makeImage = (input, id) => ({
    ...DEFAULT_RECT_STYLES,
    id,
    type: 'image',
    parentId: input.parentId,
    childIds: [],
    x: input.x,
    y: input.y,
    widthValue: input.width,
    heightValue: input.height,
    customProperties: {},
    src: input.src,
    alt: input.alt ?? '',
});
/**
 * Default visual treatment for an input drawn on the canvas — a
 * subtle outlined box so the user can see what they drew. Users are
 * free to re-style from the panel.
 */
export const NEW_INPUT_BACKGROUND = '#ffffff';
export const NEW_INPUT_BORDER_COLOR = '#cbd5e1';
export const makeInput = (input, id) => ({
    ...DEFAULT_RECT_STYLES,
    id,
    type: 'input',
    parentId: input.parentId,
    childIds: [],
    x: input.x,
    y: input.y,
    widthValue: input.width,
    heightValue: input.height,
    backgroundColor: NEW_INPUT_BACKGROUND,
    borderWidth: [1, 1, 1, 1],
    borderStyle: 'solid',
    borderColor: NEW_INPUT_BORDER_COLOR,
    borderRadius: [4, 4, 4, 4],
    customProperties: {},
    attributes: { type: 'text' },
});
export const makeComponentInstance = (input, id) => ({
    ...DEFAULT_RECT_STYLES,
    id,
    type: 'component-instance',
    parentId: input.parentId,
    childIds: [],
    // The instance has no intrinsic size on the page tree — the
    // rendered component's own root sets the box. Use `auto` on
    // both axes so the generator emits no width/height, matching
    // what `parseCode` produces for instances without a class block.
    widthMode: 'auto',
    heightMode: 'auto',
    x: input.x,
    y: input.y,
    customProperties: {},
    componentName: input.componentName,
    // Use the canvas id as the hex tail of the `inst_*` identifier
    // so `data-scamp-instance-id` is human-readable and easy to
    // correlate with the canvas selection.
    instanceId: `inst_${id}`,
    propOverrides: {},
});
/**
 * When a new rectangle or text element is drawn inside a `<ul>` or
 * `<ol>`, default its tag to `<li>` so the output semantic is correct
 * without the user having to open the Element section.
 */
export const tagForListChildContext = (parent) => {
    if (!parent)
        return undefined;
    if (parent.tag === 'ul' || parent.tag === 'ol')
        return 'li';
    return undefined;
};
