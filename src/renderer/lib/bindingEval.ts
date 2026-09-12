import type { SampleRow, SampleValue, ScampElement } from './element';
import { isRowPath } from './viewProps';

/**
 * Resolve bindings against sample data for the canvas. Prop names and
 * member paths only — no expressions, no user code. Text and attribute
 * samples already sit on their elements; what needs resolving is a row
 * path inside a repeat, a show flag, and a repeat's rows.
 * see docs/notes/view-bindings.md
 */

/** The row an element is being rendered for, inside a repeat. */
export type RowScope = { as: string; data: SampleRow; index: number };

export type BindingScope = {
  samples: Record<string, SampleValue>;
  row: RowScope | null;
};

export const EMPTY_SCOPE: BindingScope = { samples: {}, row: null };

type Resolved = string | number | boolean | SampleRow[] | undefined;

/**
 * `code`, `player.label`, `players.length`, `!canStart`. A head that
 * matches the row variable reads the row; anything else reads the root
 * samples. Unknown names resolve to undefined.
 */
export const resolveRef = (ref: string, scope: BindingScope): Resolved => {
  const inverted = ref.startsWith('!');
  const path = inverted ? ref.slice(1) : ref;
  const [head, ...rest] = path.split('.');
  if (head === undefined || head.length === 0) return undefined;
  let value: unknown =
    scope.row !== null && head === scope.row.as ? scope.row.data : scope.samples[head];
  for (const segment of rest) {
    if (value === null || value === undefined || typeof value !== 'object') {
      value = undefined;
      break;
    }
    value = (value as Record<string, unknown>)[segment];
  }
  if (inverted) return !value;
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    Array.isArray(value)
  ) {
    return value as Resolved;
  }
  return undefined;
};

/** A row-bound text element's text; undefined when the element isn't one. */
export const resolveText = (el: ScampElement, scope: BindingScope): string | undefined => {
  if (el.type !== 'text' || typeof el.prop !== 'string' || !isRowPath(el.prop)) return undefined;
  const value = resolveRef(el.prop, scope);
  if (value === undefined || Array.isArray(value)) return '';
  return String(value);
};

/** False only when the element has a show flag that resolves falsy. A flag with no sample shows. */
export const isShown = (el: ScampElement, scope: BindingScope): boolean => {
  if (el.showIf === undefined) return true;
  const inverted = el.showIf.startsWith('!');
  const flag = resolveRef(inverted ? el.showIf.slice(1) : el.showIf, scope);
  // A flag with no sample reads as true, the same default the props type
  // gives it — so `!flag` with no sample hides.
  const on = flag === undefined ? true : Boolean(flag);
  return inverted ? !on : on;
};

/** The rows a repeated element renders for; empty when the sample is missing. */
export const rowsFor = (el: ScampElement, scope: BindingScope): SampleRow[] => {
  if (el.repeat === undefined) return [];
  const value = resolveRef(el.repeat.over, scope);
  return Array.isArray(value) ? value : [];
};

/**
 * An instance's props for the canvas: its literal overrides, with any
 * row-bound prop resolved from the current row.
 */
export const resolveInstanceOverrides = (
  el: ScampElement,
  scope: BindingScope
): Record<string, string> => {
  const out: Record<string, string> = { ...(el.propOverrides ?? {}) };
  for (const [prop, expr] of Object.entries(el.bind ?? {})) {
    if (!isRowPath(expr)) continue;
    const value = resolveRef(expr, scope);
    out[prop] = value === undefined || Array.isArray(value) ? '' : String(value);
  }
  return out;
};

/**
 * Which children to render, and for which row: a hidden child is
 * dropped, a repeated child appears once per row with that row in
 * scope, and every other child inherits the caller's row.
 */
export const expandChildren = (
  elements: Record<string, ScampElement>,
  childIds: ReadonlyArray<string>,
  scope: BindingScope
): Array<{ id: string; row: RowScope | null }> => {
  const out: Array<{ id: string; row: RowScope | null }> = [];
  for (const id of childIds) {
    const child = elements[id];
    if (!child) continue;
    if (!isShown(child, scope)) continue;
    if (child.repeat !== undefined) {
      const as = child.repeat.as;
      rowsFor(child, scope).forEach((data, index) => {
        out.push({ id, row: { as, data, index } });
      });
      continue;
    }
    out.push({ id, row: scope.row });
  }
  return out;
};

/**
 * A subscription key that changes when any child's show or repeat
 * binding changes, so a parent re-expands without subscribing to the
 * whole element map.
 */
export const childBindingKey = (
  elements: Record<string, ScampElement>,
  childIds: ReadonlyArray<string>
): string =>
  childIds
    .map((id) => {
      const el = elements[id];
      if (!el) return id;
      return `${id}:${el.showIf ?? ''}:${el.repeat?.over ?? ''}:${el.repeat?.as ?? ''}`;
    })
    .join('|');
