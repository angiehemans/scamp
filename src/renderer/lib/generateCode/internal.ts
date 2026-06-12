// generateCode/internal.ts — split out of generateCode.ts (4.5).
import { ROOT_ELEMENT_ID, slugifyName, type ScampElement } from "../element";

/**
 * The CSS class name for an element. When the element has a custom name,
 * the slugified name replaces the type prefix:
 *   - unnamed rect → `rect_a1b2`
 *   - named "Hero Card" → `hero-card_a1b2`
 *   - root → `root` (always)
 */
export const classNameFor = (el: ScampElement): string => {
  if (el.id === ROOT_ELEMENT_ID) return 'root';
  // Component instances don't own a CSS class. Their identity on
  // the page is `data-scamp-instance-id` ("inst_a1b2"), so we
  // return that here — it's the only thing the layers tooltip /
  // element-class data-attr would want to surface for an
  // instance anyway.
  if (el.type === 'component-instance') {
    return el.instanceId ?? `inst_${el.id}`;
  }
  const prefix = el.name ? slugifyName(el.name) : '';
  const defaultPrefix =
    el.type === 'image'
      ? 'img'
      : el.type === 'input'
        ? 'input'
        : el.type === 'rectangle'
          ? 'rect'
          : 'text';
  return `${prefix.length > 0 ? prefix : defaultPrefix}_${el.id}`;
};


/** The HTML tag we'd use by default for an element of this type. */
const defaultTagFor = (el: ScampElement): string => {
  if (el.id === ROOT_ELEMENT_ID) return 'div';
  if (el.type === 'image') return 'img';
  if (el.type === 'input') return 'input';
  if (el.type === 'component-instance') {
    // PascalCase component name. Falls back to `div` when the
    // field is missing — defensive, shouldn't happen in practice
    // because the parser always populates it.
    return el.componentName ?? 'div';
  }
  return el.type === 'text' ? 'p' : 'div';
};


/** The actual tag to emit / render — explicit override wins over the default. */
export const tagFor = (el: ScampElement): string => {
  // Component instances aren't tag-overridable from the panel — the
  // JSX tag IS the component identity. Ignore any stray `tag` on
  // those elements.
  if (el.type === 'component-instance') return defaultTagFor(el);
  return el.tag ?? defaultTagFor(el);
};


/**
 * Collect the set of element IDs that need to establish a positioning
 * context (`position: relative` or similar) so their absolute-positioned
 * descendants anchor locally instead of escaping to a remote ancestor.
 *
 * An element needs a positioning context iff at least one of its direct
 * children will resolve to `position: absolute` in the output. A child
 * resolves to absolute when:
 *
 *   - `child.position === 'absolute'` (explicit), OR
 *   - `child.position === 'auto'` AND the parent isn't a flex/grid
 *     container (the generator's own auto rule — non-layout-parent
 *     auto children get absolute + left/top emitted).
 *
 * Root is always emitted with `position: relative` anyway, so it's
 * excluded — caller's existing branch handles it.
 *
 * See agent.md "Editability — prefer typed properties" / Scamp's
 * fallback positioning rules.
 */
export const computeElementsNeedingPositioningContext = (
  elements: Record<string, ScampElement>,
  rootId: string
): Set<string> => {
  const needs = new Set<string>();
  for (const el of Object.values(elements)) {
    if (el.id === rootId) continue;
    if (el.childIds.length === 0) continue;
    const isLayoutParent = el.display === 'flex' || el.display === 'grid';
    for (const childId of el.childIds) {
      const child = elements[childId];
      if (!child) continue;
      const childResolvesAbsolute =
        child.position === 'absolute' ||
        (child.position === 'auto' && !isLayoutParent);
      if (childResolvesAbsolute) {
        needs.add(el.id);
        break;
      }
    }
  }
  return needs;
};

