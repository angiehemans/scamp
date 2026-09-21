import { isRowPath } from './viewProps';
export const EMPTY_SCOPE = { samples: {}, row: null };
/**
 * `code`, `player.label`, `players.length`, `!canStart`. A head that
 * matches the row variable reads the row; anything else reads the root
 * samples. Unknown names resolve to undefined.
 */
export const resolveRef = (ref, scope) => {
    const inverted = ref.startsWith('!');
    const path = inverted ? ref.slice(1) : ref;
    const [head, ...rest] = path.split('.');
    if (head === undefined || head.length === 0)
        return undefined;
    let value = scope.row !== null && head === scope.row.as ? scope.row.data : scope.samples[head];
    for (const segment of rest) {
        if (value === null || value === undefined || typeof value !== 'object') {
            value = undefined;
            break;
        }
        value = value[segment];
    }
    if (inverted)
        return !value;
    if (typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        Array.isArray(value)) {
        return value;
    }
    return undefined;
};
/** A row-bound text element's text; undefined when the element isn't one. */
export const resolveText = (el, scope) => {
    if (el.type !== 'text' || typeof el.prop !== 'string' || !isRowPath(el.prop))
        return undefined;
    const value = resolveRef(el.prop, scope);
    if (value === undefined || Array.isArray(value))
        return '';
    return String(value);
};
/**
 * A row-bound attribute's value for the current row; undefined when the
 * attribute isn't bound to a row path, in which case the sample on the
 * element is the value. `src` on a repeated `<img>` is the case that
 * made this necessary. see docs/notes/view-bindings.md
 */
export const resolveAttr = (el, attr, scope) => {
    const expr = el.bind?.[attr];
    if (expr === undefined || !isRowPath(expr))
        return undefined;
    const value = resolveRef(expr, scope);
    if (value === undefined || Array.isArray(value))
        return '';
    return String(value);
};
/** False only when the element has a show flag that resolves falsy. A flag with no sample shows. */
export const isShown = (el, scope) => {
    if (el.showIf === undefined)
        return true;
    const inverted = el.showIf.startsWith('!');
    const flag = resolveRef(inverted ? el.showIf.slice(1) : el.showIf, scope);
    // A flag with no sample reads as true, the same default the props type
    // gives it — so `!flag` with no sample hides.
    const on = flag === undefined ? true : Boolean(flag);
    return inverted ? !on : on;
};
/** The rows a repeated element renders for; empty when the sample is missing. */
export const rowsFor = (el, scope) => {
    if (el.repeat === undefined)
        return [];
    const value = resolveRef(el.repeat.over, scope);
    return Array.isArray(value) ? value : [];
};
/**
 * An instance's props for the canvas: its literal overrides, with any
 * row-bound prop resolved from the current row.
 */
export const resolveInstanceOverrides = (el, scope) => {
    const out = { ...(el.propOverrides ?? {}) };
    for (const [prop, expr] of Object.entries(el.bind ?? {})) {
        if (!isRowPath(expr))
            continue;
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
export const expandChildren = (elements, childIds, scope) => {
    const out = [];
    for (const id of childIds) {
        const child = elements[id];
        if (!child)
            continue;
        if (!isShown(child, scope))
            continue;
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
export const childBindingKey = (elements, childIds) => childIds
    .map((id) => {
    const el = elements[id];
    if (!el)
        return id;
    return `${id}:${el.showIf ?? ''}:${el.repeat?.over ?? ''}:${el.repeat?.as ?? ''}`;
})
    .join('|');
