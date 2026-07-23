export const TEXT_STYLE_PROPS = [
    'family',
    'size',
    'weight',
    'leading',
    'tracking',
];
// `--text-<name>-<prop>` — the `<name>` is greedy so multi-word slugs
// (`body-large`) resolve correctly. Bare scale tokens like `--text-xs`
// (no known prop suffix) are NOT text-style tokens.
const TEXT_STYLE_RE = /^--text-(.+)-(family|size|weight|leading|tracking)$/;
/** True when a token belongs to a text-style group (vs a bare scale step). */
export const isTextStyleToken = (name) => TEXT_STYLE_RE.test(name);
/** The token name for one prop of a text style. */
export const textStyleTokenName = (name, prop) => `--text-${name}-${prop}`;
/** Title-case a slug into a label: `body-large` → `Body Large`. */
export const textStyleLabel = (name) => name
    .split('-')
    .filter((w) => w.length > 0)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
/**
 * Group the flat token list into text styles, in first-seen order. Only
 * `--text-<name>-<prop>` tokens participate; each style carries the raw
 * value for every prop it defines (null otherwise).
 */
export const buildTextStyles = (tokens) => {
    const byName = new Map();
    const order = [];
    const bucket = (name) => {
        const existing = byName.get(name);
        if (existing)
            return existing;
        const fresh = {};
        byName.set(name, fresh);
        order.push(name);
        return fresh;
    };
    for (const t of tokens) {
        const m = t.name.match(TEXT_STYLE_RE);
        if (!m || m[1] === undefined || m[2] === undefined)
            continue;
        bucket(m[1])[m[2]] = t.value;
    }
    return order.map((name) => {
        const props = byName.get(name) ?? {};
        return {
            name,
            label: textStyleLabel(name),
            family: props.family ?? null,
            size: props.size ?? null,
            weight: props.weight ?? null,
            leading: props.leading ?? null,
            tracking: props.tracking ?? null,
        };
    });
};
export const DEFAULT_TEXT_STYLE_TEMPLATES = [
    { name: 'display', size: '3.5rem', weight: '800', leading: '1.1' },
    { name: 'h1', size: '2.5rem', weight: '700', leading: '1.2' },
    { name: 'h2', size: '2rem', weight: '700', leading: '1.25' },
    { name: 'h3', size: '1.5rem', weight: '600', leading: '1.3' },
    { name: 'h4', size: '1.25rem', weight: '600', leading: '1.35' },
    { name: 'body-large', size: '1.125rem', weight: '400', leading: '1.6' },
    { name: 'body', size: '1rem', weight: '400', leading: '1.5' },
    { name: 'body-small', size: '0.875rem', weight: '400', leading: '1.5' },
    { name: 'label', size: '0.75rem', weight: '500', leading: '1.4' },
    { name: 'code', size: '0.875rem', weight: '400', leading: '1.6', family: 'var(--font-mono)' },
];
/** Emit the `--text-<name>-<prop>` tokens for one template. */
export const textStyleTokensFromTemplate = (t) => [
    { name: textStyleTokenName(t.name, 'family'), value: t.family ?? 'var(--font-sans)' },
    { name: textStyleTokenName(t.name, 'size'), value: t.size },
    { name: textStyleTokenName(t.name, 'weight'), value: t.weight },
    { name: textStyleTokenName(t.name, 'leading'), value: t.leading },
];
/** The full default text-style token set (all templates flattened). */
export const defaultTextStyleTokens = () => DEFAULT_TEXT_STYLE_TEMPLATES.flatMap(textStyleTokensFromTemplate);
