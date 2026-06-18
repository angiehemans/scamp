/**
 * Barrel for the TSX+CSS → canvas-state parser. Split (4.4) into:
 *   - `parseCode/tsx.ts`    — TSX structure parse (parseTsxStructure).
 *   - `parseCode/css.ts`    — CSS-module declaration parse.
 *   - `parseCode/apply.ts`  — overlay declarations onto baseline elements.
 *   - `parseCode/index.ts`  — the `parseCode` entry + `findDuplicateDeclProps`.
 *
 * Re-export preserves every `@lib/parseCode` import.
 */
export * from './parseCode/index';
