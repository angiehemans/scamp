/**
 * Shared component name validator + slugifier. Same shape as
 * `pageName.ts`, but the rules are different: a component name
 * has to be a valid React function identifier, so it's PascalCase
 * letters + digits with no hyphens / underscores. The component
 * name doubles as the folder name, the JSX tag, and the import
 * binding, so changing the convention without a renumber dance
 * means renaming every reference in every page.
 */
export type ComponentNameValidation = {
    ok: true;
    value: string;
} | {
    ok: false;
    error: string;
};
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
export declare const validateComponentName: (raw: string, existingNames: ReadonlyArray<string>) => ComponentNameValidation;
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
export declare const suggestComponentName: (raw: string) => string;
