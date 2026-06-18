/**
 * Barrel for the element data model. Split for navigability (4.2):
 *   - `element/types.ts` — the `ScampElement` shape + every related
 *     type, plus the `ELEMENT_STATES` / `ROOT_ELEMENT_ID` constants.
 *   - `element/tree.ts` — pure tree mutators (reorder / group / wrap /
 *     ungroup / clone) + the `generateElementId` / `slugifyName` utils.
 *
 * Import sites keep using `@lib/element`; this re-export preserves them.
 */
export * from './element/types';
export * from './element/tree';
