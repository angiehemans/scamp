import type { Breakpoint } from '@shared/types';
/**
 * What a save actually writes to the view file.
 *
 * Phase 3 of docs/plans/incremental-writes-plan.md, and the twin of
 * `cssWrite.ts`. Rewrite the regions the generator owns — the styles
 * and component imports, the props type, the component itself, the
 * `_scamp` export — and leave every other byte of the file alone.
 *
 * Measured before this existed, a save on a file Scamp had not written
 * dropped an unrelated import, a module-level constant, a comment above
 * the component, and an export beside the default one. Now it keeps
 * them.
 *
 * As with the stylesheet, the patch is verified before it is offered:
 * the patched file has to parse to the same element map as the
 * generated one, or the save writes the generated file instead.
 */
export type TsxWrite = {
    tsx: string;
    /** False when the patch was skipped or failed verification. */
    patched: boolean;
};
export type TsxWriteInput = {
    /** What we believe is on disk. Null before the first save of a target. */
    baseTsx: string | null;
    generatedTsx: string;
    /** The stylesheet that goes with it, needed to parse in context. */
    css: string;
    breakpoints: ReadonlyArray<Breakpoint>;
    isComponent: boolean;
};
export declare const tsxWriteFor: (input: TsxWriteInput) => TsxWrite;
