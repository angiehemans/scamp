/**
 * Shared component name validator + slugifier. Same shape as
 * `pageName.ts`, but the rules are different: a component name
 * has to be a valid React function identifier, so it's PascalCase
 * letters + digits with no hyphens / underscores. The component
 * name doubles as the folder name, the JSX tag, and the import
 * binding, so changing the convention without a renumber dance
 * means renaming every reference in every page.
 */
const COMPONENT_NAME_RE = /^[A-Z][A-Za-z0-9]*$/;
/**
 * Validate a component name as the user is typing.
 *
 * Rules:
 *   - starts with an uppercase ASCII letter
 *   - subsequent characters are letters or digits only
 *   - non-empty
 *   - doesn't collide with any of `existingNames` (case-sensitive
 *     because PascalCase distinctions matter for JSX resolution)
 *
 * Trims outer whitespace before validating.
 */
export const validateComponentName = (raw, existingNames) => {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
        return { ok: false, error: 'Name is required.' };
    }
    if (!COMPONENT_NAME_RE.test(trimmed)) {
        return {
            ok: false,
            error: 'Use PascalCase letters and digits only (e.g. Button, HeroCard).',
        };
    }
    for (const existing of existingNames) {
        if (existing === trimmed) {
            return {
                ok: false,
                error: `A component named "${trimmed}" already exists.`,
            };
        }
    }
    return { ok: true, value: trimmed };
};
/**
 * Convert a free-form user input into a PascalCase component name
 * suggestion. Used by the "+ Add Component" flow's name input to
 * gently nudge users toward the convention without forcing it on
 * every keystroke (the input still validates on confirm).
 *
 *   "hero card"   → "HeroCard"
 *   "hero-card"   → "HeroCard"
 *   "hero_card"   → "HeroCard"
 *   "HERO CARD"   → "HeroCard"
 *   "123hero"     → "Hero"  (leading digits stripped)
 *   ""            → ""
 */
export const suggestComponentName = (raw) => {
    // Split on any non-alphanumeric boundary, lowercase + capitalize
    // the first LETTER of each surviving chunk (digits in the
    // capitalization slot are skipped over, so `123hero` capitalises
    // the `h` rather than emitting `123hero` literally), then join.
    const parts = raw
        .split(/[^A-Za-z0-9]+/)
        .filter((p) => p.length > 0);
    const camelChunks = parts.map((p) => {
        const lower = p.toLowerCase();
        // Find the first letter in the chunk and capitalise it. If
        // the chunk is digits-only (no letter), keep it verbatim —
        // it might be a legitimate internal digit segment like the
        // `2` in `Heading2`. The final `replace(/^[0-9]+/, '')` below
        // trims any leading digits the join leaves behind.
        const firstLetterIdx = lower.search(/[a-z]/);
        if (firstLetterIdx < 0)
            return lower;
        return (lower.slice(0, firstLetterIdx) +
            lower.charAt(firstLetterIdx).toUpperCase() +
            lower.slice(firstLetterIdx + 1));
    });
    const joined = camelChunks.join('');
    // Strip any leading digits — JSX identifiers can't start with
    // a number.
    return joined.replace(/^[0-9]+/, '');
};
