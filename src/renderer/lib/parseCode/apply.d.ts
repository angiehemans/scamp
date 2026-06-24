import { type BreakpointOverride, type ScampElement, type StateOverride } from "../element";
import { type RawDeclaration } from "./css";
import { type RawElement } from "./tsx";
/**
 * Apply a list of declarations as a breakpoint override. Unlike
 * `applyDeclarations` (which overlays onto a full element baseline
 * and returns a full element), this returns a Partial carrying just
 * the fields the declarations touch — the right shape for
 * `element.breakpointOverrides[bpId]`.
 */
export declare const applyDeclarationsAsOverride: (decls: RawDeclaration[]) => BreakpointOverride;
/**
 * Like `applyDeclarationsAsOverride` but also parses the `animation`
 * shorthand into the typed `StateOverride.animation` field. Used for
 * pseudo-class state blocks (`:hover`, `:active`, `:focus`) where
 * per-state animations are supported.
 *
 * Multi-animation source (commas at the top level) round-trips via
 * `customProperties.animation` exactly like the base path — the
 * picker doesn't model the multi case but the value is preserved.
 */
export declare const applyDeclarationsAsStateOverride: (decls: RawDeclaration[]) => StateOverride;
export declare const makeRoot: (isComponent?: boolean) => ScampElement;
export declare const makeBaseline: (raw: RawElement, isComponent?: boolean) => ScampElement;
/**
 * Apply a list of declarations to an element. Returns a new element with
 * mapped properties applied and unmapped ones stored verbatim in
 * customProperties.
 *
 * Position properties (`position`, `left`, `top`) are handled inline since
 * they affect element fields that aren't in cssToScampProperty.
 */
export declare const applyDeclarations: (baseline: ScampElement, decls: RawDeclaration[]) => ScampElement;
