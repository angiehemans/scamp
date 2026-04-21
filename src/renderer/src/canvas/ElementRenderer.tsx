import {
  CSSProperties,
  ElementType,
  FocusEvent,
  KeyboardEvent,
  PointerEvent,
  createElement,
  useEffect,
  useRef,
} from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { ROOT_ELEMENT_ID, type ScampElement } from '@lib/element';
import { tagFor } from '@lib/generateCode';
import { customPropsToStyle } from '@lib/customProps';
import type { ThemeToken } from '@shared/types';
import { EMPTY_FRAME_MIN_HEIGHT } from './Viewport';
import styles from './ElementRenderer.module.css';

const VAR_RE = /^var\(\s*(--[\w-]+)\s*\)$/;
const URL_RELATIVE_RE = /url\(\s*["']?(\.\/[^"')]+)["']?\s*\)/g;

/** HTML void elements — React throws if createElement receives children for these. */
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'source', 'track', 'wbr',
]);

/**
 * A handful of tags we deliberately render with a different element on
 * the canvas than in the generated TSX. The canvas is a design surface,
 * not a runtime — a real `<dialog open>` would go modal, a real
 * `<svg>` would try to interpret its source. Both scenarios interfere
 * with placing, selecting, and sizing the box.
 *
 * The generator still emits the true tag to disk; this override only
 * affects the DOM node React renders inside the canvas iframe.
 */
const canvasRenderTag = (tag: string): string => {
  if (tag === 'dialog') return 'div';
  if (tag === 'svg') return 'div';
  return tag;
};

/**
 * Attribute names we never forward from the element's `attributes`
 * bag to the canvas DOM. Each has a reason:
 *   - tag-specific side effects we don't want on a design surface
 *     (`open` on dialog, `href` on anchor → navigation, etc.)
 *   - React/JSX-only names the DOM wouldn't understand
 */
const CANVAS_SKIP_ATTRS_BY_TAG: Record<string, ReadonlySet<string>> = {
  a: new Set(['href', 'target']),
  dialog: new Set(['open']),
  form: new Set(['action', 'method']),
  button: new Set(['type']),
};

/** Resolve a `var(--name)` reference against theme tokens. */
const resolveTokenColor = (
  value: string,
  tokens: ReadonlyArray<ThemeToken>
): string => {
  if (tokens.length === 0) return value;
  const m = value.match(VAR_RE);
  if (!m) return value;
  const found = tokens.find((t) => t.name === m[1]);
  return found ? found.value : 'transparent';
};

/**
 * Resolve a `var(--name)` reference against theme tokens for non-colour
 * properties. Unknown tokens return the raw value so React's inline
 * style system gets something it understands (falling back to browser
 * default rather than the "transparent" sentinel we use for colours).
 */
const resolveTokenValue = (
  value: string | undefined,
  tokens: ReadonlyArray<ThemeToken>
): string | undefined => {
  if (!value) return value;
  const m = value.match(VAR_RE);
  if (!m) return value;
  const found = tokens.find((t) => t.name === m[1]);
  return found ? found.value : value;
};

type Props = {
  elementId: string;
};

const elementToStyle = (
  el: ScampElement,
  parentDisplay: 'flex' | 'none' | undefined,
  parentDirection: 'row' | 'column' | undefined,
  tokens: ReadonlyArray<ThemeToken>,
  projectDir: string | null
): CSSProperties => {
  const isRoot = el.id === ROOT_ELEMENT_ID;
  // Flex children flow with the layout engine — drop position/left/top so
  // the browser places them. Matches what we emit in generateCode.
  const inFlexParent = parentDisplay === 'flex';
  const isRow = parentDirection !== 'column'; // default flex direction is row
  // 'auto' produces `undefined` so the rendered element inherits the
  // browser default — exactly what an absent CSS declaration would do.
  const widthStyle =
    el.widthMode === 'stretch'
      ? '100%'
      : el.widthMode === 'fit-content'
        ? 'fit-content'
        : el.widthMode === 'auto'
          ? undefined
          : el.widthValue;
  const heightStyle =
    el.heightMode === 'stretch'
      ? '100%'
      : el.heightMode === 'fit-content'
        ? 'fit-content'
        : el.heightMode === 'auto'
          ? undefined
          : el.heightValue;
  // The page root uses `min-height` so the page frame grows vertically
  // with its content (like a real web page). Other elements use a fixed
  // `height` so they stay the size the user gave them.
  // In a flex parent, `width/height: 100%` can collapse to 0 because
  // there's no explicit containing-block size for `%` to resolve
  // against. Handle stretch per-axis:
  //   - Main axis stretch → `flex: 1` (grow to fill available space)
  //   - Cross axis stretch → `align-self: stretch` (fill cross axis)
  // The main axis depends on the parent's flex-direction (row → width
  // is main, column → height is main).
  let effectiveWidth: string | number | undefined = widthStyle;
  let effectiveHeight: string | number | undefined = isRoot ? undefined : heightStyle;
  const flexProps: CSSProperties = {};

  if (inFlexParent) {
    const widthIsMain = isRow;
    // Main axis stretch → flex: 1, drop the explicit size
    if (el.widthMode === 'stretch' && widthIsMain) {
      flexProps.flex = 1;
      flexProps.minWidth = 0;
      effectiveWidth = undefined;
    } else if (el.heightMode === 'stretch' && !widthIsMain) {
      flexProps.flex = 1;
      flexProps.minHeight = 0;
      effectiveHeight = undefined;
    }
    // Cross axis stretch → align-self: stretch (drop the explicit size)
    if (el.widthMode === 'stretch' && !widthIsMain) {
      flexProps.alignSelf = 'stretch';
      effectiveWidth = undefined;
    } else if (el.heightMode === 'stretch' && widthIsMain) {
      flexProps.alignSelf = 'stretch';
      effectiveHeight = undefined;
    }
  }

  const base: CSSProperties = {
    // Flex children render as `position: relative` so they remain a
    // positioning context for their own `position: absolute` descendants
    // (e.g. a text child placed inside a flex-placed rect). Without this
    // the text would anchor to the nearest positioned ancestor instead —
    // typically root — and escape the visual box of its parent even
    // though the tree structure puts it inside.
    position: isRoot ? 'relative' : inFlexParent ? 'relative' : 'absolute',
    left: isRoot || inFlexParent ? undefined : el.x,
    top: isRoot || inFlexParent ? undefined : el.y,
    width: effectiveWidth,
    height: effectiveHeight,
    // Canvas-only floor on the root's rendered height. Without this,
    // root defaults to `height: auto` and collapses to its content
    // size — flex layout then has no vertical space to distribute, so
    // `justify-content: center` on a flex-column root appears not to
    // work. Matches the frame's visible min-height so the user's flex
    // centering intent reads correctly on the canvas. NOT written to
    // the exported CSS — users who want centering in production still
    // need to set `min-height: 100vh` themselves.
    minHeight: isRoot ? `${EMPTY_FRAME_MIN_HEIGHT}px` : undefined,
    ...flexProps,
    background: resolveTokenColor(el.backgroundColor, tokens),
    borderRadius: `${el.borderRadius[0]}px ${el.borderRadius[1]}px ${el.borderRadius[2]}px ${el.borderRadius[3]}px`,
    boxSizing: 'border-box',
    // Reset browser-default margins on semantic text tags (h1, p, etc.)
    // so the canvas position matches the stored coordinates.
    margin: 0,
  };
  const [bwt, bwr, bwb, bwl] = el.borderWidth;
  if (el.borderStyle !== 'none' && (bwt || bwr || bwb || bwl)) {
    base.borderWidth = `${bwt}px ${bwr}px ${bwb}px ${bwl}px`;
    base.borderStyle = el.borderStyle;
    base.borderColor = resolveTokenColor(el.borderColor, tokens);
  }
  if (el.display === 'flex') {
    base.display = 'flex';
    base.flexDirection = el.flexDirection;
    base.gap = el.gap;
    base.alignItems = el.alignItems;
    base.justifyContent = el.justifyContent;
  }
  const [pt, pr, pb, pl] = el.padding;
  if (pt || pr || pb || pl) {
    base.padding = `${pt}px ${pr}px ${pb}px ${pl}px`;
  }
  const [mt, mr, mb, ml] = el.margin;
  if (mt || mr || mb || ml) {
    base.margin = `${mt}px ${mr}px ${mb}px ${ml}px`;
  }
  if (el.type === 'text') {
    if (el.fontFamily !== undefined)
      base.fontFamily = resolveTokenValue(el.fontFamily, tokens);
    if (el.fontSize !== undefined)
      base.fontSize = resolveTokenValue(el.fontSize, tokens);
    if (el.fontWeight !== undefined) base.fontWeight = el.fontWeight;
    if (el.color !== undefined) base.color = resolveTokenColor(el.color, tokens);
    if (el.textAlign !== undefined) base.textAlign = el.textAlign;
    if (el.lineHeight !== undefined)
      base.lineHeight = resolveTokenValue(el.lineHeight, tokens);
    if (el.letterSpacing !== undefined)
      base.letterSpacing = resolveTokenValue(el.letterSpacing, tokens);
  }
  if (el.type === 'image') {
    base.objectFit = 'cover';
    base.display = 'block';
  }
  // Visibility + opacity
  // - `visibility: hidden` renders literally so canvas matches export.
  // - `visibility: none` is NOT applied literally (would hit-test out of
  //   existence); the `.hiddenNone` class dims + stripes the element so
  //   it stays selectable. CSS export still emits `display: none`.
  if (el.visibilityMode === 'hidden') {
    base.visibility = 'hidden';
  }
  // Dim the element by 65% when hidden-none; combine with user opacity
  // so a 50%-opaque element reads as ~17% when also hidden.
  const hiddenMultiplier = el.visibilityMode === 'none' ? 0.35 : 1;
  const effectiveOpacity = (el.opacity ?? 1) * hiddenMultiplier;
  if (effectiveOpacity !== 1) {
    base.opacity = effectiveOpacity;
  }
  // Spread customProperties LAST so unmapped CSS the user / agent
  // wrote (box-shadow, line-height, font-family, margin, …) actually
  // renders on the canvas. Anything in customProperties is, by
  // construction, NOT a property scamp routes to a typed field — so
  // there's no conflict with the assignments above. The reset
  // `margin: 0` we apply earlier IS overridable here, which is what
  // we want: a user-written `margin-bottom: 8px` should win over the
  // browser-default-reset.
  const customStyle = customPropsToStyle(el.customProperties);
  // Resolve relative `url("./...")` references in custom properties to
  // absolute `scamp-asset://` URLs so background-image etc. load correctly
  // on the canvas preview.
  if (projectDir) {
    for (const [key, value] of Object.entries(customStyle)) {
      if (typeof value === 'string' && value.includes('url(')) {
        (customStyle as Record<string, string>)[key] = value.replace(
          URL_RELATIVE_RE,
          (_match, relPath: string) => {
            const absPath = `${projectDir}/${relPath.slice(2)}`;
            return `url("scamp-asset://localhost/${encodeURI(absPath.replace(/^\/+/, ''))}")`;
          }
        );
      }
    }
  }
  return { ...base, ...customStyle };
};

export const ElementRenderer = ({ elementId }: Props): JSX.Element | null => {
  const element = useCanvasStore((s) => s.elements[elementId]);
  const parentDisplay = useCanvasStore((s) => {
    const el = s.elements[elementId];
    if (!el || !el.parentId) return undefined;
    return s.elements[el.parentId]?.display;
  });
  const parentDirection = useCanvasStore((s) => {
    const el = s.elements[elementId];
    if (!el || !el.parentId) return undefined;
    return s.elements[el.parentId]?.flexDirection;
  });
  const themeTokens = useCanvasStore((s) => s.themeTokens);
  const activePage = useCanvasStore((s) => s.activePage);
  const isSelected = useCanvasStore((s) => s.selectedElementIds.includes(elementId));
  const isEditing = useCanvasStore((s) => s.editingElementId === elementId);
  const setEditingElement = useCanvasStore((s) => s.setEditingElement);
  const setElementText = useCanvasStore((s) => s.setElementText);
  // The ref is attached to the element's DOM node — for text elements
  // it's the contentEditable target during edit mode.
  const elementRef = useRef<HTMLElement | null>(null);

  // Focus the editable region as soon as the element enters edit mode and
  // select all of its text so the user can immediately overwrite it.
  useEffect(() => {
    if (!isEditing) return;
    const node = elementRef.current;
    if (!node) return;
    // preventScroll: the element is inside a `transform: scale`d frame in
    // an overflow:auto container. Default focus() scrolls the element
    // into view, which on Mac visibly shifts the canvas and makes the
    // newly-placed text appear offset from where the user clicked.
    node.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(node);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [isEditing]);

  // While editing, a click anywhere outside the editable should commit and
  // exit. We trigger that by blurring the element, which fires the existing
  // onBlur handler.
  useEffect(() => {
    if (!isEditing) return;
    const handleDocPointerDown = (e: MouseEvent): void => {
      const node = elementRef.current;
      if (!node) return;
      if (node.contains(e.target as Node)) return;
      node.blur();
    };
    document.addEventListener('mousedown', handleDocPointerDown);
    return () => document.removeEventListener('mousedown', handleDocPointerDown);
  }, [isEditing]);

  if (!element) return null;

  const isText = element.type === 'text';
  const isImage = element.type === 'image';
  const projectDir = activePage
    ? activePage.tsxPath.replace(/\\/g, '/').replace(/\/[^/]+$/, '')
    : null;
  const style = elementToStyle(element, parentDisplay, parentDirection, themeTokens, projectDir);
  // The actual HTML tag — uses the element's stored override if any,
  // otherwise the type's default (`p` for text, `div` for rect).
  const storedTag = tagFor(element);
  const tag = canvasRenderTag(storedTag) as ElementType;

  const handleEditableBlur = (e: FocusEvent<HTMLElement>): void => {
    const next = e.currentTarget.textContent ?? '';
    setElementText(element.id, next);
    setEditingElement(null);
  };

  const handleEditableKeyDown = (e: KeyboardEvent<HTMLElement>): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.currentTarget.blur();
    }
    // Allow Enter for line breaks; commit on blur instead.
  };

  // Build a single set of props for the dynamic-tag element. Text and
  // rectangle differ only in their children: text renders the element's
  // text directly inside (so the tag wraps the text the way real HTML
  // does), rectangles render their child elements recursively.
  const props: Record<string, unknown> = {
    'data-scamp-id': element.id,
    'data-element-id': element.id,
    className: `${styles.element} ${isSelected ? styles.selected : ''} ${
      isText && isEditing ? styles.textEditing : ''
    } ${element.visibilityMode === 'none' ? styles.hiddenNone : ''}`.trim(),
    style,
    ref: elementRef,
  };

  // Forward tag-specific attributes from the element's attribute bag
  // to the canvas DOM so the preview reflects them (e.g. input
  // placeholder, textarea rows, video controls). A small per-tag deny
  // list blocks attrs that would trigger side effects (navigation,
  // form submission) on the canvas.
  if (element.attributes) {
    const skip = CANVAS_SKIP_ATTRS_BY_TAG[storedTag] ?? new Set<string>();
    for (const [name, value] of Object.entries(element.attributes)) {
      if (skip.has(name)) continue;
      // Boolean attributes stored as "" map to React-style `true`.
      props[name] = value === '' ? true : value;
    }
  }

  // Interaction side-effects prevention for tags that would otherwise
  // navigate or submit. The canvas is a design surface, not a runtime.
  if (storedTag === 'a' || storedTag === 'button') {
    const prevOnClick = props['onClick'];
    props['onClick'] = (e: PointerEvent<HTMLElement>) => {
      e.preventDefault();
      if (typeof prevOnClick === 'function') (prevOnClick as (ev: typeof e) => void)(e);
    };
  }

  if (isText && isEditing) {
    props['contentEditable'] = true;
    props['suppressContentEditableWarning'] = true;
    props['onBlur'] = handleEditableBlur;
    props['onKeyDown'] = handleEditableKeyDown;
    // Stop pointer events from bubbling so the user can place the
    // cursor / select text without triggering canvas interactions.
    props['onPointerDown'] = (e: PointerEvent<HTMLElement>) => e.stopPropagation();
  }

  // Only real `<img>` elements carry typed src/alt. Other media tags
  // (video, iframe, svg) store their src/title/etc. in the attribute
  // bag, which we've already spread above.
  if (isImage && storedTag === 'img') {
    // The element stores a relative path (e.g. `./assets/hero.png`) that
    // makes sense from the project root. In the Electron renderer, relative
    // URLs resolve against the dev-server or the app's HTML file — neither
    // of which is the project folder. Resolve to an absolute URL using the
    // custom `scamp-asset://` protocol registered in the main process.
    let resolvedSrc = element.src ?? '';
    if (activePage && resolvedSrc.startsWith('./')) {
      const projectDir = activePage.tsxPath.replace(/\\/g, '/').replace(/\/[^/]+$/, '');
      const absPath = `${projectDir}/${resolvedSrc.slice(2)}`;
      resolvedSrc = `scamp-asset://localhost/${encodeURI(absPath.replace(/^\/+/, ''))}`;
    }
    props['src'] = resolvedSrc;
    props['alt'] = element.alt ?? '';
  }

  // Void HTML elements (img, input, br, hr, etc.) cannot have children
  // in React — even an empty array throws. Short-circuit for any void
  // tag so agent-written markup that uses <input />, <br />, etc.
  // renders without crashing.
  if (VOID_TAGS.has(tag as string)) {
    return createElement(tag, props);
  }

  const children = isText
    ? (element.text ?? '')
    : element.childIds.map((childId) => (
        <ElementRenderer key={childId} elementId={childId} />
      ));

  return createElement(tag, props, children);
};
