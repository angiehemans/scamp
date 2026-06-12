/**
 * Barrel for the page/component code generator. Split (4.5) into:
 *   - `generateCode/internal.ts` — cross-cutting helpers (classNameFor,
 *     tagFor, positioning-context computation).
 *   - `generateCode/tsx.ts`      — JSX tree emit (renderJsx, generateTsx).
 *   - `generateCode/declarations.ts` — per-element + breakpoint CSS
 *     declaration lines.
 *   - `generateCode/css.ts`      — CSS module assembly (generateCss).
 *   - `generateCode/index.ts`    — the `generateCode` entry + types.
 *
 * `generateCodeLegacy` was removed here (it only wrapped generateCode
 * with cssModuleImportName=pageName and had no app callsites).
 * Re-exports preserve every `@lib/generateCode` import.
 */
export * from './generateCode/index';
export * from './generateCode/declarations';
export { classNameFor, tagFor } from './generateCode/internal';
