import type { Breakpoint } from '@shared/types';
/**
 * What a save actually writes to the stylesheet.
 *
 * Phase 2 of docs/plans/incremental-writes-plan.md. Instead of replacing
 * the file with a freshly generated one, rewrite only the rules whose
 * declarations changed and leave the rest of the file as it is. The
 * write itself is still a whole-file atomic write; what changes is how
 * much of the content differs.
 *
 * The case this is really for is the first save after opening a project
 * Scamp did not write. Until now that reformatted the whole stylesheet
 * and dropped anything the generator has no opinion about.
 *
 * Every patch is verified before it is offered: the patched stylesheet
 * has to parse to the same element map as the generated one. If it
 * doesn't, the save falls back to the generated file, so this can only
 * ever be as correct as what it replaces.
 */
export type CssWrite = {
    /** The content to write. */
    css: string;
    /** False when the patch was skipped or failed verification. */
    patched: boolean;
};
export type CssWriteInput = {
    /** What we believe is on disk. Null before the first save of a target. */
    baseCss: string | null;
    generatedCss: string;
    /** The TSX that goes with it, needed to parse the stylesheet in context. */
    tsx: string;
    breakpoints: ReadonlyArray<Breakpoint>;
    isComponent: boolean;
};
export declare const cssWriteFor: (input: CssWriteInput) => CssWrite;
