/** The types offered as menu choices (order = display order). The
 *  `label` is the menu's text; the trigger button shows an icon only. */
export const SIZE_TYPE_OPTIONS = [
    { type: 'px', label: 'Fixed' },
    { type: 'percent', label: 'Percent' },
    { type: 'fill', label: 'Fill' },
    { type: 'hug', label: 'Hug' },
    { type: 'auto', label: 'Auto' },
];
/** Derive the current type from the stored mode + verbatim custom string. */
export const sizeTypeOf = (mode, custom) => {
    if (mode === 'stretch')
        return 'fill';
    if (mode === 'fit-content')
        return 'hug';
    if (mode === 'auto')
        return 'auto';
    // fixed
    const c = (custom ?? '').trim().toLowerCase();
    if (c.length === 0)
        return 'px';
    if (c.endsWith('%'))
        return 'percent';
    if (c.endsWith('vh'))
        return 'vh';
    if (c.endsWith('vw'))
        return 'vw';
    return 'custom';
};
/** Short label shown on the type button. */
export const sizeTypeLabel = (type) => {
    switch (type) {
        case 'px':
            return 'px';
        case 'percent':
            return '%';
        case 'fill':
            return 'Fill';
        case 'hug':
            return 'Hug';
        case 'auto':
            return 'Auto';
        case 'vh':
            return 'vh';
        case 'vw':
            return 'vw';
        case 'custom':
            return 'CSS';
    }
};
/** True when the type carries an editable numeric value in the field. */
export const sizeTypeHasNumber = (type) => type !== 'fill' && type !== 'hug' && type !== 'auto';
/** Unit appended to a bare number typed while this type is active. */
const unitSuffix = (type) => {
    switch (type) {
        case 'percent':
            return '%';
        case 'vh':
            return 'vh';
        case 'vw':
            return 'vw';
        default:
            // px, and the keyword types (typing a number leaves them for a
            // fixed px size).
            return 'px';
    }
};
/**
 * The raw CSS-length string to commit when the user picks `type` from
 * the menu, seeding the numeric value from `num` for unit types.
 */
export const rawForType = (type, num) => {
    switch (type) {
        case 'px':
            return `${num}px`;
        case 'percent':
            return `${num}%`;
        case 'vh':
            return `${num}vh`;
        case 'vw':
            return `${num}vw`;
        case 'fill':
            return '100%';
        case 'hug':
            return 'fit-content';
        case 'auto':
            return 'auto';
        case 'custom':
            return `${num}px`;
    }
};
/**
 * Combine what the user typed in the number field with the active type:
 * a bare number gets the active unit appended; a full CSS length or a
 * keyword the user typed is respected verbatim (so typing `auto`,
 * `50vh`, `calc(...)` still works and can change the type).
 */
export const combineTypedWithType = (typed, type) => {
    const t = typed.trim();
    if (t.length === 0)
        return t;
    if (/^-?\d+(?:\.\d+)?$/.test(t))
        return `${t}${unitSuffix(type)}`;
    return t;
};
