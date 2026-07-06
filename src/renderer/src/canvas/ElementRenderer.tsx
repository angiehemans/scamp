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
import { type ScampElement } from '@lib/element';
import { classNameFor, tagFor } from '@lib/generateCode';
import {
  CANVAS_SKIP_ATTRS_BY_TAG,
  canvasRenderTag,
  elementToStyle,
} from '@lib/elementToStyle';
import { DEFAULT_ROOT_STYLES } from '@lib/defaults';
import { resolveElementAtBreakpoint } from '@lib/breakpointCascade';
import { resolveElementAtState } from '@lib/stateCascade';
import { formatAnimationShorthand } from '@lib/parsers';
import type { ThemeToken } from '@shared/types';
import { sanitizeSvgInner } from '../lib/svg';
import { EMPTY_FRAME_MIN_HEIGHT } from './Viewport';
import styles from './ElementRenderer.module.css';

/** HTML void elements — React throws if createElement receives children for these. */
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'source', 'track', 'wbr',
]);

/** True iff root matches the blank-component scaffold (style-aware). see docs/notes/components-data-model.md */
const isScaffoldRoot = (root: ScampElement): boolean => {
  return (
    root.childIds.length === 0 &&
    root.inlineFragments.length === 0 &&
    root.backgroundColor === DEFAULT_ROOT_STYLES.backgroundColor &&
    root.widthMode === DEFAULT_ROOT_STYLES.widthMode &&
    root.heightMode === DEFAULT_ROOT_STYLES.heightMode &&
    root.borderWidth.every((v) => v === 0) &&
    root.borderRadius.every((v) => v === 0) &&
    root.padding.every((v) => v === 0) &&
    root.boxShadows.length === 0 &&
    root.opacity === DEFAULT_ROOT_STYLES.opacity &&
    root.minHeight === DEFAULT_ROOT_STYLES.minHeight
  );
};

type Props = {
  elementId: string;
};

const renderComponentSubtree = (
  element: ScampElement,
  elementsMap: Record<string, ScampElement>,
  parentDisplay: 'flex' | 'grid' | 'none' | undefined,
  parentDirection: 'row' | 'column' | undefined,
  propOverrides: Record<string, string>,
  tokens: ReadonlyArray<ThemeToken>,
  projectDir: string | null,
  projectFormat: 'legacy' | 'nextjs',
  projectPath: string | null,
  /**
   * Threaded through every recursive call so the wrapper that
   * tags prop-text knows which instance owns the value. The
   * canvas hit-test and the prop-edit commit both key off this
   * id — without it, two instances of the same component on one
   * page would write into each other's overrides.
   */
  instanceId: string,
  /**
   * The current edit target, if any. When the recursion reaches
   * a text element whose `prop` matches AND whose owning instance
   * matches `instanceId`, that node renders as a contentEditable
   * span instead of a plain text node. Null when nothing is being
   * edited, or when an edit on a different instance is in flight.
   */
  editingProp: string | null,
  /**
   * Called when the user commits an edit (blur or Enter on the
   * contentEditable). Caller is responsible for clearing
   * `editingInstanceProp` after the commit.
   */
  onCommitProp: (propName: string, value: string) => void,
  /**
   * Called when the user enters edit mode on a prop-text (double-
   * click) or exits via Escape. The canvas store's
   * `setEditingInstanceProp` is the natural binding; the prop
   * is wrapped here so the renderer doesn't have to pull it from
   * the store at every node.
   */
  onChangeEditingProp: (propName: string | null) => void,
  /**
   * True when the owning instance is the current selection. Prop-text
   * only shows its dashed edit affordance while the instance is
   * selected — otherwise the page is noisy with outlines around every
   * editable string on every instance.
   */
  instanceSelected: boolean
): JSX.Element | null => {
  // Slot composition deferred: nested instances render as placeholders.
  if (element.type === 'component-instance') {
    return (
      <div
        key={element.id}
        style={{
          padding: '4px 8px',
          background: 'rgba(99, 102, 241, 0.12)',
          border: '1px dashed var(--accent, #6366f1)',
          borderRadius: 4,
          color: 'var(--text-secondary)',
          fontSize: 12,
        }}
      >
        Nested {element.componentName}
      </div>
    );
  }
  const style = elementToStyle(
    element,
    parentDisplay,
    parentDirection,
    tokens,
    projectDir,
    projectFormat,
    // Inner subtree: strip page-canvas-only affordances (the
    // 900px EMPTY_FRAME_MIN_HEIGHT floor, the
    // "root drops fixed height" behaviour) so the component's
    // root renders at its real designed size, not as a
    // full-canvas-sized white box.
    true,
    // rootMinHeight is unused when isInstanceInner is true; pass the
    // page-canvas floor to satisfy the (now required) param.
    EMPTY_FRAME_MIN_HEIGHT
  );
  const storedTag = tagFor(element);
  const tag = canvasRenderTag(storedTag) as ElementType;
  const className = classNameFor(element);

  const props: Record<string, unknown> = {
    'data-scamp-id': className,
    style,
  };
  // Forward agent-written attributes through the same per-tag deny
  // list the page renderer uses (no href navigation, no form
  // action, etc.).
  if (element.attributes) {
    const skip = CANVAS_SKIP_ATTRS_BY_TAG[storedTag] ?? new Set<string>();
    for (const [name, value] of Object.entries(element.attributes)) {
      if (skip.has(name)) continue;
      props[name] = value === '' ? true : value;
    }
  }

  // <img> src/alt routing — same `scamp-asset://` rewrite as the
  // page renderer so component-defined images load correctly on
  // the canvas preview.
  if (element.type === 'image' && storedTag === 'img') {
    let resolvedSrc = element.src ?? '';
    if (projectPath && resolvedSrc.startsWith('./')) {
      const absPath = `${projectPath.replace(/\\/g, '/')}/${resolvedSrc.slice(2)}`;
      resolvedSrc = `scamp-asset://localhost/${encodeURI(absPath.replace(/^\/+/, ''))}`;
    } else if (
      projectPath &&
      projectFormat === 'nextjs' &&
      resolvedSrc.startsWith('/')
    ) {
      const absPath = `${projectPath.replace(/\\/g, '/')}/public${resolvedSrc}`;
      resolvedSrc = `scamp-asset://localhost/${encodeURI(absPath.replace(/^\/+/, ''))}`;
    }
    props['src'] = resolvedSrc;
    props['alt'] = element.alt ?? '';
  }

  if (VOID_TAGS.has(tag as string)) {
    return createElement(tag, { ...props, key: element.id });
  }

  // SVG inside a component instance renders its real (sanitized) source
  // too, so instances on the page match the component definition. Use a
  // real <svg> element (NOT canvasRenderTag, which maps svg→div for the
  // legacy placeholder) so the shapes render in the SVG namespace and
  // the element-level fill/stroke recolour them.
  if (storedTag === 'svg') {
    return createElement('svg', {
      ...props,
      key: element.id,
      dangerouslySetInnerHTML: {
        __html: sanitizeSvgInner(element.svgSource ?? ''),
      },
    });
  }

  const isText = element.type === 'text';
  // Substitute propOverride → literal default for prop-text.
  // see docs/notes/components-data-model.md
  const propName =
    isText && typeof element.prop === 'string' && element.prop.length > 0
      ? element.prop
      : null;
  const overrideValue =
    propName !== null ? propOverrides[propName] : undefined;
  const defaultText =
    isText && typeof element.text === 'string' ? element.text : undefined;
  const textContent: string | undefined =
    overrideValue !== undefined ? overrideValue : defaultText;

  const hasText =
    isText && typeof textContent === 'string' && textContent.length > 0;
  const hasChildren = element.childIds.length > 0;

  // Prop-text always carries the hit-test attrs and overrides the
  // inner wrapper's `pointer-events: none` so `elementsFromPoint`
  // surfaces it for `propTextHitTest`. The dashed edit affordance
  // only shows once the owning instance is selected — otherwise a
  // page full of instances would be noisy with outlines around
  // every editable string. The affordance lives on a CSS-module
  // class so PNG / SVG export can strip it the same way it strips
  // `.selected`.
  const isEditingThisProp = propName !== null && editingProp === propName;
  if (isText && propName !== null) {
    props['data-scamp-instance-id'] = instanceId;
    props['data-scamp-prop'] = propName;
    // `props.style` is still the `style` local here (only attrs/src/alt
    // are written above), so read the typed CSSProperties directly
    // rather than casting the `unknown`-valued bag entry.
    props['style'] = { ...style, pointerEvents: 'auto' };
    if (instanceSelected) {
      const existing =
        typeof props['className'] === 'string' ? props['className'] : '';
      props['className'] = existing
        ? `${existing} ${styles.propEditAffordance}`
        : styles.propEditAffordance;
    }
  }
  // Locked text on an instance — hint via native tooltip.
  if (isText && propName === null) {
    props['title'] = 'Locked text — edit in the component definition.';
  }

  if (!hasChildren && !hasText && !isEditingThisProp) {
    return createElement(tag, { ...props, key: element.id });
  }
  if (isEditingThisProp && propName !== null) {
    const handleBlur: import('react').FocusEventHandler<HTMLElement> = (e) => {
      const next = e.currentTarget.textContent ?? '';
      onCommitProp(propName, next);
    };
    const handleKeyDown: import('react').KeyboardEventHandler<HTMLElement> = (
      e
    ) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onChangeEditingProp(null);
      } else if (e.key === 'Enter') {
        // Enter commits (line breaks need explicit \n escape, not surfaced).
        e.preventDefault();
        const next = (e.currentTarget as HTMLElement).textContent ?? '';
        onCommitProp(propName, next);
      }
    };
    return createElement(
      tag,
      {
        ...props,
        key: element.id,
        contentEditable: true,
        suppressContentEditableWarning: true,
        spellCheck: false,
        onBlur: handleBlur,
        onKeyDown: handleKeyDown,
        ref: (node: HTMLElement | null) => {
          // Focus + select-all on mount.
          if (!node) return;
          node.focus({ preventScroll: true });
          const range = document.createRange();
          range.selectNodeContents(node);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        },
      },
      textContent ?? ''
    );
  }
  if (hasText && !hasChildren) {
    return createElement(tag, { ...props, key: element.id }, textContent);
  }

  // Derive parent display / direction once so children's
  // elementToStyle behaves correctly inside flex / grid parents.
  const childParentDisplay =
    element.display === 'flex' || element.display === 'grid'
      ? element.display
      : 'none';
  const childParentDirection =
    element.display === 'flex' ? element.flexDirection : undefined;

  const children = element.childIds
    .map((childId) => {
      const child = elementsMap[childId];
      if (!child) return null;
      return renderComponentSubtree(
        child,
        elementsMap,
        childParentDisplay,
        childParentDirection,
        propOverrides,
        tokens,
        projectDir,
        projectFormat,
        projectPath,
        instanceId,
        editingProp,
        onCommitProp,
        onChangeEditingProp,
        instanceSelected
      );
    })
    .filter((c): c is JSX.Element => c !== null);

  return createElement(tag, { ...props, key: element.id }, children);
};

export const ElementRenderer = ({ elementId }: Props): JSX.Element | null => {
  const rawElement = useCanvasStore((s) => s.elements[elementId]);
  const activeBreakpointId = useCanvasStore((s) => s.activeBreakpointId);
  const activeStateName = useCanvasStore((s) => s.activeStateName);
  const breakpoints = useCanvasStore((s) => s.breakpoints);
  const isSelected = useCanvasStore((s) => s.selectedElementIds.includes(elementId));
  // Resolve overrides at render time. Selected elements get the
  // active state's overrides layered in (the state switcher *is* the
  // canvas preview); non-selected elements always render their
  // default state. When nothing applies, this is a no-op identity
  // return.
  const previewState =
    isSelected && activeStateName !== null ? activeStateName : null;
  const element = rawElement
    ? resolveElementAtState(
        rawElement,
        activeBreakpointId,
        breakpoints,
        previewState
      )
    : undefined;
  // Parent resolution doesn't carry a state preview — only the
  // selected element previews its hover/active/focus styles. The
  // parent's layout (flex / grid behaviour) is whatever the
  // breakpoint cascade resolves.
  const parentResolved = useCanvasStore((s) => {
    const el = s.elements[elementId];
    if (!el || !el.parentId) return undefined;
    const parent = s.elements[el.parentId];
    if (!parent) return undefined;
    return resolveElementAtBreakpoint(parent, s.activeBreakpointId, s.breakpoints);
  });
  const parentDisplay = parentResolved?.display;
  const parentDirection = parentResolved?.flexDirection;
  const themeTokens = useCanvasStore((s) => s.themeTokens);
  const projectFormat = useCanvasStore((s) => s.projectFormat);
  // Canvas-frame min height — page editor uses
  // EMPTY_FRAME_MIN_HEIGHT, component editor uses the
  // user-configured `componentCanvas[name].height`. ProjectShell
  // keeps this in sync with the active target. The root element
  // uses it as its own min-height so the root fills the visible
  // canvas regardless of content size.
  const canvasMinHeight = useCanvasStore((s) => s.canvasMinHeight);
  // Canvas animation preview — set when the user clicks Play in the
  // AnimationSection. The matching element re-renders with a fresh
  // `key` so React forces a remount and the CSS animation plays
  // from the top. Non-matching elements never receive an animation
  // declaration on the canvas, so loops don't run during normal
  // editing — too distracting.
  const previewAnimation = useCanvasStore((s) =>
    s.previewAnimation?.elementId === elementId ? s.previewAnimation : null
  );
  const projectPath = useCanvasStore((s) => s.projectPath);
  const isEditing = useCanvasStore((s) => s.editingElementId === elementId);
  const setEditingElement = useCanvasStore((s) => s.setEditingElement);
  const setElementText = useCanvasStore((s) => s.setElementText);
  const selectElement = useCanvasStore((s) => s.selectElement);
  // Component-tree lookup for `component-instance` elements. The
  // selector is keyed by `componentName`, so a tree edit that
  // doesn't change THIS instance's component name is a no-op
  // re-render. When the element isn't an instance, the selector
  // returns undefined and React skips the deeper subscription.
  const componentTreeForInstance = useCanvasStore((s) => {
    const rawEl = s.elements[elementId];
    if (!rawEl || rawEl.type !== 'component-instance') return undefined;
    if (!rawEl.componentName) return undefined;
    return s.componentTrees[rawEl.componentName];
  });
  const requestComponentNavigation = useCanvasStore(
    (s) => s.requestComponentNavigation
  );
  // Phase 6: per-instance inline editing. The pair is non-null when
  // a prop-text inside SOME instance is in contentEditable mode.
  // The recursive subtree render compares the instance id to
  // decide whether to render the contentEditable form.
  const editingInstanceProp = useCanvasStore((s) => s.editingInstanceProp);
  const setEditingInstanceProp = useCanvasStore(
    (s) => s.setEditingInstanceProp
  );
  const setPropOverride = useCanvasStore((s) => s.setPropOverride);
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
  const isComponentInstance = element.type === 'component-instance';
  const projectDir = projectPath ? projectPath.replace(/\\/g, '/') : null;
  const baseStyle = elementToStyle(
    element,
    parentDisplay,
    parentDirection,
    themeTokens,
    projectDir,
    projectFormat,
    false,
    canvasMinHeight
  );
  // When the canvas is previewing a non-default state for this
  // element, suppress transitions so the user sees the resolved end
  // state instantly rather than an animation halfway through.
  // Renderer-only — has no effect on the file on disk.
  let style =
    previewState !== null
      ? { ...baseStyle, transition: 'none' }
      : baseStyle;

  // Animation preview: when the user clicks Play, apply the resolved
  // animation as an inline declaration. Iteration is clamped to 1 so
  // even infinite loops play once on the canvas — preview should be a
  // single demonstration, not a perpetual distraction. `paused`
  // animations skip the preview entirely (the user explicitly
  // chose to pause). The React `key` on the element forces a remount
  // each Play click so the animation re-runs from the top.
  if (
    previewAnimation !== null &&
    element.animation &&
    element.animation.playState !== 'paused' &&
    !element.toggledOffGroups.includes('animation')
  ) {
    style = {
      ...style,
      animation: formatAnimationShorthand({
        ...element.animation,
        iterationCount: 1,
      }),
    };
  }
  // Component-instance render branch. Instances appear as a
  // single selectable element on the page tree; the visible
  // contents are the component definition's own element subtree,
  // rendered from `componentTrees[name].elements`. We wrap the
  // subtree in a positioned div that owns selection / double-
  // click / context-menu, and apply `pointer-events: none` to
  // the inner subtree so every click lands on the wrapper.
  //
  // Double-click navigates the canvas into the component editor
  // for this instance's component (one-shot request consumed by
  // `ProjectShell`'s `pendingComponentNavigation` effect).
  if (isComponentInstance) {
    const handleInstanceClick = (
      e: import('react').MouseEvent<HTMLElement>
    ): void => {
      e.stopPropagation();
      selectElement(element.id);
    };
    const handleInstanceDoubleClick = (
      e: import('react').MouseEvent<HTMLElement>
    ): void => {
      e.preventDefault();
      e.stopPropagation();
      const name = element.componentName;
      if (name) requestComponentNavigation(name);
    };
    const handleInstanceContextMenu = (
      e: import('react').MouseEvent<HTMLElement>
    ): void => {
      e.preventDefault();
      e.stopPropagation();
      selectElement(element.id);
      window.dispatchEvent(
        new CustomEvent('scamp:open-element-context-menu', {
          detail: { x: e.clientX, y: e.clientY, elementId: element.id },
        })
      );
    };
    const wrapperProps = {
      'data-element-id': element.id,
      'data-scamp-instance-id': element.instanceId ?? '',
      className: `${styles.element} ${isSelected ? styles.selected : ''}`.trim(),
      style,
      onClick: handleInstanceClick,
      onDoubleClick: handleInstanceDoubleClick,
      onContextMenu: handleInstanceContextMenu,
    };
    // Missing-component placeholder (componentName not in cache).
    if (!componentTreeForInstance) {
      return (
        <div
          {...wrapperProps}
          style={{
            ...style,
            padding: '8px 12px',
            background: 'rgba(220, 38, 38, 0.08)',
            border: '1px dashed #dc2626',
            borderRadius: 4,
            color: '#7f1d1d',
            fontSize: 12,
            fontFamily: 'var(--font-ui)',
          }}
        >
          Missing component: {element.componentName ?? '(unnamed)'}
        </div>
      );
    }
    const root =
      componentTreeForInstance.elements[componentTreeForInstance.rootId];
    const isEmptyComponent = root !== undefined && isScaffoldRoot(root);
    // Only honour the edit target when it points at THIS instance.
    const editingPropForThis =
      editingInstanceProp && editingInstanceProp.instanceId === element.id
        ? editingInstanceProp.propName
        : null;
    const handleCommitProp = (propName: string, value: string): void => {
      setPropOverride(element.id, propName, value);
      setEditingInstanceProp(null);
    };
    const handleChangeEditingProp = (propName: string | null): void => {
      if (propName === null) {
        setEditingInstanceProp(null);
      } else {
        setEditingInstanceProp({ instanceId: element.id, propName });
      }
    };
    const inner = root
      ? renderComponentSubtree(
          root,
          componentTreeForInstance.elements,
          // Pass page-side layout context so flex/grid still applies.
          parentDisplay,
          parentDirection,
          element.propOverrides ?? {},
          themeTokens,
          projectDir,
          projectFormat,
          projectPath,
          element.id,
          editingPropForThis,
          handleCommitProp,
          handleChangeEditingProp,
          isSelected
        )
      : null;
    if (isEmptyComponent) {
      return (
        <div
          {...wrapperProps}
          style={{
            ...style,
            padding: '12px 16px',
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px dashed var(--accent, #6366f1)',
            borderRadius: 4,
            color: 'var(--text-secondary)',
            fontSize: 12,
            fontFamily: 'var(--font-ui)',
            minWidth: 80,
            minHeight: 32,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {element.componentName ?? 'Component'} (empty — double-click to edit)
        </div>
      );
    }
    // The inner wrapper is a real `display: block` div (NOT
    // `display: contents`). `display: contents` makes the
    // wrapper transparent to layout, so percentage widths inside
    // the component leak up to the page root's containing block
    // — a component whose root has `width: 100%` then expands to
    // the full page canvas instead of hugging the instance
    // wrapper. With a real block in place, the component's
    // children resolve their percentage widths against the inner
    // div, which is itself content-sized, so `100%` falls back
    // to `auto` and the instance hugs its content as expected.
    return (
      <div {...wrapperProps}>
        <div
          style={{ pointerEvents: 'none', display: 'block' }}
          aria-hidden="true"
        >
          {inner}
        </div>
      </div>
    );
  }

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
  const handleContextMenu = (
    e: import('react').MouseEvent<HTMLElement>
  ): void => {
    // Don't open a context menu while the user is mid-text-edit on
    // this element — the browser's native edit menu is more useful
    // there.
    if (isText && isEditing) return;
    e.preventDefault();
    e.stopPropagation();
    // Select the element so the properties panel switches to its
    // WYSIWYG view and the Export section's scope reflects the
    // right-clicked target.
    selectElement(element.id);
    window.dispatchEvent(
      new CustomEvent('scamp:open-element-context-menu', {
        detail: { x: e.clientX, y: e.clientY, elementId: element.id },
      })
    );
  };

  const props: Record<string, unknown> = {
    // `data-scamp-id` mirrors the CSS class name, matching what the code
    // generator writes to disk. `data-element-id` is the raw internal id
    // used by canvas hit-testing and selection — keep it separate so
    // renames don't force a refactor of every lookup site.
    'data-scamp-id': classNameFor(element),
    'data-element-id': element.id,
    onContextMenu: handleContextMenu,
    // Animation preview: increment the React key on each Play click
    // so React remounts the element and the CSS animation plays from
    // the top. Stays undefined when not previewing so we don't churn
    // the DOM during normal renders.
    ...(previewAnimation !== null
      ? { key: `preview-${previewAnimation.key}` }
      : {}),
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
    // The element stores a path that makes sense at runtime: legacy
    // projects use `./assets/foo.png` (relative to the page file);
    // nextjs projects use `/assets/foo.png` (Next.js serves `public/`
    // at the URL root). In the Electron renderer neither resolves
    // against the project folder, so map both to the custom
    // `scamp-asset://` protocol registered in the main process.
    let resolvedSrc = element.src ?? '';
    if (projectPath && resolvedSrc.startsWith('./')) {
      const absPath = `${projectPath.replace(/\\/g, '/')}/${resolvedSrc.slice(2)}`;
      resolvedSrc = `scamp-asset://localhost/${encodeURI(absPath.replace(/^\/+/, ''))}`;
    } else if (
      projectPath &&
      projectFormat === 'nextjs' &&
      resolvedSrc.startsWith('/')
    ) {
      // Nextjs absolute server-root path → `<project>/public/<path>`.
      const absPath = `${projectPath.replace(/\\/g, '/')}/public${resolvedSrc}`;
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

  // SVG: inject the stored inner source so the real artwork renders on
  // the canvas (not a placeholder box). Sanitized at this render sink so
  // even agent-written source can't execute. Must be a real <svg> element
  // (NOT canvasRenderTag, which maps svg→div for the legacy placeholder) —
  // otherwise the shapes land in the HTML namespace and don't paint. The
  // element-level fill/stroke then recolours the shapes inside.
  if (storedTag === 'svg') {
    return createElement('svg', {
      ...props,
      dangerouslySetInnerHTML: {
        __html: sanitizeSvgInner(element.svgSource ?? ''),
      },
    });
  }

  const children = isText
    ? (element.text ?? '')
    : element.childIds.map((childId) => (
        <ElementRenderer key={childId} elementId={childId} />
      ));

  return createElement(tag, props, children);
};
