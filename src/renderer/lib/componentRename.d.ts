import type { Breakpoint } from '@shared/types';
type RewriteOptions = {
    breakpoints?: ReadonlyArray<Breakpoint>;
};
/** Flip a component file's function name, Props type, and import basename. */
export declare const rewriteComponentForRename: (tsx: string, css: string, _oldName: string, newName: string, options?: RewriteOptions) => {
    tsx: string;
    css: string;
};
/** Rewrite a page TSX/CSS to use newName for matching instances. `changed: false` → skip the disk write. */
export declare const rewritePageForComponentRename: (tsx: string, css: string, oldName: string, newName: string, pageName: string, format: "legacy" | "nextjs", options?: RewriteOptions) => {
    tsx: string;
    css: string;
    changed: boolean;
};
export {};
