import { DEFAULT_RECT_STYLES } from './defaults';
/** `#hex` (3/4/6/8) or `rgb()/rgba()` to `[r,g,b,a]`; null when neither. */
const toRgba = (color) => {
    const c = color.trim().toLowerCase();
    const hex = /^#([0-9a-f]{3,8})$/.exec(c);
    if (hex) {
        let h = hex[1] ?? '';
        if (h.length === 3 || h.length === 4) {
            h = h
                .split('')
                .map((ch) => ch + ch)
                .join('');
        }
        if (h.length !== 6 && h.length !== 8)
            return null;
        return [
            parseInt(h.slice(0, 2), 16),
            parseInt(h.slice(2, 4), 16),
            parseInt(h.slice(4, 6), 16),
            h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
        ];
    }
    const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?/.exec(c);
    if (!rgb)
        return null;
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] === undefined ? 1 : Number(rgb[4])];
};
/**
 * A colour as the panel wants it: `#rrggbb`, or `rgba(...)` kept as-is
 * when it is translucent, since hex-with-alpha is not what the colour
 * control reads.
 */
export const normalizeColor = (color) => {
    const rgba = toRgba(color);
    if (rgba === null)
        return null;
    const [r, g, b, a] = rgba;
    if (a < 1)
        return `rgba(${r}, ${g}, ${b}, ${Math.round(a * 100) / 100})`;
    const hex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    return `#${hex(r)}${hex(g)}${hex(b)}`;
};
/** Saturation, 0-1. Used only to tell an accent from a neutral. */
const saturationOf = (color) => {
    const rgba = toRgba(color);
    if (rgba === null)
        return 0;
    const [r, g, b] = rgba;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max === 0)
        return 0;
    return (max - min) / max;
};
/** The colour-bearing typed fields, and the role each one suggests. */
const COLOR_FIELDS = [
    { field: 'color', role: 'text' },
    { field: 'backgroundColor', role: 'surface' },
    { field: 'borderColor', role: 'border' },
];
/**
 * Is this colour actually painting anything?
 *
 * The model gives every element a `borderColor` of `#000000` whether or
 * not it has a border, so counting the field blindly reports black as
 * the most popular colour on every page ever imported. A colour counts
 * only when it differs from the field's default AND, for a border,
 * when there is a border for it to be.
 */
const isInEffect = (el, field) => {
    const value = el[field];
    if (typeof value !== 'string' || value.length === 0)
        return false;
    if (value === DEFAULT_RECT_STYLES[field])
        return false;
    if (field !== 'borderColor')
        return true;
    const widths = el.borderWidth;
    const hasWidth = Array.isArray(widths) && widths.some((w) => (typeof w === 'number' ? w > 0 : w !== undefined));
    return hasWidth && el.borderStyle !== 'none';
};
const tally = (elements) => {
    const seen = new Map();
    const record = (raw, role) => {
        if (typeof raw !== 'string' || raw.length === 0)
            return;
        if (raw === 'transparent' || raw.startsWith('var('))
            return;
        const value = normalizeColor(raw);
        if (value === null)
            return;
        const entry = seen.get(value) ?? { value, roles: new Map(), uses: 0 };
        entry.uses += 1;
        entry.roles.set(role, (entry.roles.get(role) ?? 0) + 1);
        seen.set(value, entry);
    };
    for (const el of Object.values(elements)) {
        for (const { field, role } of COLOR_FIELDS) {
            if (!isInEffect(el, field))
                continue;
            record(el[field], role);
        }
    }
    return seen;
};
/**
 * Give each kept colour a name.
 *
 * The most-used colour in a role takes that role's name; the rest are
 * numbered by how much they are used, so the important ones get the
 * short names. An accent — the most saturated colour that is not
 * already the text or background — is worth naming even when it is used
 * less, because it is the one a person will want to change first.
 */
const nameTokens = (kept) => {
    const byUses = [...kept].sort((a, b) => b.uses - a.uses);
    const taken = new Map();
    const claim = (name, usage) => {
        if (usage === undefined)
            return;
        if ([...taken.values()].includes(usage))
            return;
        if (taken.has(name))
            return;
        taken.set(name, usage);
    };
    const topOf = (role) => byUses.find((u) => (u.roles.get(role) ?? 0) === Math.max(...byUses.map((x) => x.roles.get(role) ?? 0)) && (u.roles.get(role) ?? 0) > 0);
    const unclaimed = () => byUses.filter((u) => ![...taken.values()].includes(u));
    // Text first: it is the most reliable signal on any page.
    claim('--color-text', topOf('text'));
    // Then the accent, BEFORE the background role gets to claim a
    // surface. A strongly saturated colour on a couple of elements is a
    // button, not the ground the page sits on — and naming it
    // `--color-background` would be both wrong and the first thing
    // someone tried to change.
    const accent = [...unclaimed()].sort((a, b) => saturationOf(b.value) - saturationOf(a.value))[0];
    if (accent && saturationOf(accent.value) > 0.35)
        claim('--color-accent', accent);
    claim('--color-background', topOf('surface'));
    claim('--color-border', topOf('border'));
    // Anything still unnamed is a real colour used more than once, and a
    // numbered token still beats forty copies of the same literal.
    let n = 1;
    for (const usage of unclaimed()) {
        claim(`--color-${n}`, usage);
        n += 1;
    }
    return [...taken.entries()].map(([name, usage]) => ({
        name,
        value: usage.value,
        uses: usage.uses,
    }));
};
/**
 * Extract tokens and rewrite the elements to reference them.
 *
 * Returns the elements unchanged when nothing repeats enough to be
 * worth naming — an import of a two-colour page should not gain a
 * theme it does not need.
 */
export const extractTokens = (elements, options = {}) => {
    const minUses = options.minUses ?? 2;
    const maxTokens = options.maxTokens ?? 16;
    const kept = [...tally(elements).values()]
        .filter((u) => u.uses >= minUses)
        .sort((a, b) => b.uses - a.uses)
        .slice(0, maxTokens);
    if (kept.length === 0)
        return { tokens: [], elements };
    const tokens = nameTokens(kept);
    const byValue = new Map(tokens.map((t) => [t.value, t.name]));
    const next = {};
    for (const [id, el] of Object.entries(elements)) {
        let updated = el;
        for (const { field } of COLOR_FIELDS) {
            if (!isInEffect(updated, field))
                continue;
            const raw = updated[field];
            if (typeof raw !== 'string' || raw.startsWith('var('))
                continue;
            const normalized = normalizeColor(raw);
            const name = normalized === null ? undefined : byValue.get(normalized);
            if (name === undefined)
                continue;
            updated = { ...updated, [field]: `var(${name})` };
        }
        next[id] = updated;
    }
    return { tokens, elements: next };
};
