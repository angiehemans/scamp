import { parseCode } from '@lib/parseCode';
import type { Breakpoint } from '@shared/types';
export type MergeWriteInput = {
    /** The version the refused write claimed was on disk. */
    baseTsx: string;
    baseCss: string;
    /** What that write carried. */
    oursTsx: string;
    oursCss: string;
    /** What disk actually holds. */
    theirsTsx: string;
    theirsCss: string;
    breakpoints: ReadonlyArray<Breakpoint>;
    isComponent: boolean;
};
export type MergedWrite = {
    tsx: string;
    css: string;
    /** Parsed once here, so the caller can reload the canvas without repeating it. */
    parsed: ReturnType<typeof parseCode>;
    /** Regions taken from the other side, for the log line. */
    fromTheirs: number;
};
export declare const mergeWrite: (input: MergeWriteInput) => MergedWrite | null;
