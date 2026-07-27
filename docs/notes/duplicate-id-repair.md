# Duplicate `data-scamp-id` repair on load

## The problem

Every Scamp element's identity is the 4-char hex id in its
`data-scamp-id` (and its matching CSS class). Ids must be unique per
page. A malformed file (an agent that duplicated an element and reused
the id, a hand-edit) can contain the same id twice. Left alone, the
tree ends up with two parents referencing one element — the layers
panel double-renders it (duplicate React key), the canvas renders it
twice, and `byId` silently keeps only the last occurrence, orphaning
the first's subtree.

## The fix — reassign in `parseCode` (lossless)

`parseTsxStructure` (`parseCode/tsx.ts`) reassigns the LATER occurrence a
fresh id, in place, at the moment its open-tag is parsed — before its
children, so the whole subtree adopts the new id. Both elements survive.

- **Deterministic id.** `freshHexId(base, reserved)` derives the new hex
  from the colliding id and steps until it finds a free one. No
  randomness, so `parseCode` stays pure and the parse→generate→parse
  round-trip is stable. `reserved` is seeded with EVERY id in the source
  (a regex pre-pass) so a generated id can't collide with a real id that
  appears later in the single streaming pass.
- **Styling preserved.** The reassigned element gets a new class
  (`rect_1a2b` → `rect_<newhex>`), but its `RawElement.dedupedFrom`
  records the ORIGINAL class. `index.ts` sources the element's styles
  from `dedupedFrom`, so the repaired copy looks identical. On the next
  save the generator emits a second class block with those styles — the
  duplicate becomes a true independent copy.

## Notify, don't decide silently

`parseCode` returns `duplicateIdRepairs: { from, to }[]`. The load path
(`useActiveTarget`) logs a `warn` to the activity log ("Repaired N
duplicate element id(s) …; save to persist"). The repair is in-memory
until the next save; once saved, the ids are distinct and subsequent
parses report nothing. Idempotent by construction.
