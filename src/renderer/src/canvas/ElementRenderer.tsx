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
import styles from './ElementRenderer.module.css';

const VAR_RE = /^var\(\s*(--[\w-]+)\s*\)$/;

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

type Props = {
  elementId: string;
};

const elementToStyle = (
  el: ScampElement,
  parentDisplay: 'flex' | 'none' | undefined,
  tokens: ReadonlyArray<ThemeToken>
): CSSProperties => {
  const isRoot = el.id === ROOT_ELEMENT_ID;
  // Flex children flow with the layout engine — drop position/left/top so
  // the browser places them. Matches what we emit in generateCode.
  const inFlexParent = parentDisplay === 'flex';
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
  const base: CSSProperties = {
    position: isRoot ? 'relative' : inFlexParent ? 'relative' : 'absolute',
    left: isRoot || inFlexParent ? undefined : el.x,
    top: isRoot || inFlexParent ? undefined : el.y,
    width: widthStyle,
    height: isRoot ? undefined : heightStyle,
    minHeight: isRoot ? heightStyle : undefined,
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
    if (el.fontFamily !== undefined) base.fontFamily = el.fontFamily;
    if (el.fontSize !== undefined) base.fontSize = el.fontSize;
    if (el.fontWeight !== undefined) base.fontWeight = el.fontWeight;
    if (el.color !== undefined) base.color = resolveTokenColor(el.color, tokens);
    if (el.textAlign !== undefined) base.textAlign = el.textAlign;
    if (el.lineHeight !== undefined) base.lineHeight = el.lineHeight;
    if (el.letterSpacing !== undefined) base.letterSpacing = el.letterSpacing;
  }
  // Spread customProperties LAST so unmapped CSS the user / agent
  // wrote (box-shadow, line-height, font-family, margin, …) actually
  // renders on the canvas. Anything in customProperties is, by
  // construction, NOT a property scamp routes to a typed field — so
  // there's no conflict with the assignments above. The reset
  // `margin: 0` we apply earlier IS overridable here, which is what
  // we want: a user-written `margin-bottom: 8px` should win over the
  // browser-default-reset.
  return { ...base, ...customPropsToStyle(el.customProperties) };
};

export const ElementRenderer = ({ elementId }: Props): JSX.Element | null => {
  const element = useCanvasStore((s) => s.elements[elementId]);
  const parentDisplay = useCanvasStore((s) => {
    const el = s.elements[elementId];
    if (!el || !el.parentId) return undefined;
    return s.elements[el.parentId]?.display;
  });
  const themeTokens = useCanvasStore((s) => s.themeTokens);
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
    node.focus();
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
  const style = elementToStyle(element, parentDisplay, themeTokens);
  // The actual HTML tag — uses the element's stored override if any,
  // otherwise the type's default (`p` for text, `div` for rect).
  const tag = tagFor(element) as ElementType;

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
    }`.trim(),
    style,
    ref: elementRef,
  };

  if (isText && isEditing) {
    props['contentEditable'] = true;
    props['suppressContentEditableWarning'] = true;
    props['onBlur'] = handleEditableBlur;
    props['onKeyDown'] = handleEditableKeyDown;
    // Stop pointer events from bubbling so the user can place the
    // cursor / select text without triggering canvas interactions.
    props['onPointerDown'] = (e: PointerEvent<HTMLElement>) => e.stopPropagation();
  }

  const children = isText
    ? (element.text ?? '')
    : element.childIds.map((childId) => (
        <ElementRenderer key={childId} elementId={childId} />
      ));

  return createElement(tag, props, children);
};
