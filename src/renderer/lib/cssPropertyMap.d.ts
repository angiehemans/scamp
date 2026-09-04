import type { ScampElement } from './element';
/**
 * A delta over an element produced from a single CSS declaration. Anything
 * the canvas can model goes here; anything else lands in `customProperties`.
 */
export type ScampPropertyDelta = Partial<ScampElement>;
/**
 * A mapper turns a CSS value string into a delta over the typed
 * canvas element. Returning `null` means "I can't reduce this value
 * to a typed field — preserve the raw declaration in
 * customProperties instead". Returning `{}` is a deliberate "this
 * value is intentionally a no-op" (rare).
 *
 * The lossless contract: the parser must never silently drop
 * agent-written values. Agent writes `padding: var(--space-3)` →
 * `parsePaddingShorthandOrNull` returns null → mapper returns null →
 * the parser pushes `padding: var(--space-3)` into customProperties
 * → the generator emits it back byte-equivalent.
 */
type Mapper = (value: string) => ScampPropertyDelta | null;
export declare const cssToScampProperty: Record<string, Mapper>;
export declare const isMappedProperty: (name: string) => boolean;
export {};
