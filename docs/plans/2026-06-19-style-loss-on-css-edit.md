# Style-loss on CSS-tab edit (agent-seeded projects) — investigation & fix plan

**Date:** 2026-06-19
**Status:** ROOT CAUSE CONFIRMED + reproduced from the real project
(`micro-graphics` / api page). Fix implemented in `parseCode/css.ts`;
pending shim regen + full-suite verification.
**Severity:** Critical — silent, persistent data loss of user styling.

---

## CONFIRMED ROOT CAUSE (supersedes the hypotheses below)

Reproduced exactly: `parseCode → generateCode` on the pre-corruption file
(`.scamp/snapshots/snap_395bd4907f86/app/api`) collapses all 49+ elements to
`position: absolute; left: 0; top: 0` (691 → 336 CSS lines), matching the
corrupted disk byte-for-byte. Two bugs, both in the pure lib
`src/renderer/lib/parseCode/css.ts`:

- **Bug A — scamp emits invalid CSS.** Raw/verbatim selector blocks (e.g.
  the `.card:hover .arrow { color: …; transform: … }` micro-interactions,
  preserved because they're descendant selectors) were serialized with
  `Declaration.toString()`, which omits the trailing `;`. Any raw block with
  ≥2 declarations re-emitted as `color: var(--fg)` ⏎ `transform: …` — **no
  separating semicolon** → invalid CSS. (Browsers tolerate it via error
  recovery, so it looked fine; the canvas in-memory state stayed good. This
  is why it only broke "after canvas edits" — the first canvas edit wrote
  the malformed file to disk.)
- **Bug B — one CSS error wipes the whole page.** `parseCssDeclarations`
  wrapped `postcss.parse(css)` in `try/catch` and, on any error, returned
  an **empty** class map. Every element then hit `byClass.get(name) ?? []`
  → `DEFAULT_RECT_STYLES`. The collapse was then written to disk by the next
  edit/reconcile and copied into every subsequent snapshot.

Trigger sequence: agent writes valid hover CSS → scamp parses + stores it
(losing the semicolons, Bug A) → first canvas edit regenerates and writes the
now-malformed CSS to disk → a later CSS-mode edit forces a full re-parse →
`postcss.parse` throws → Bug B collapses every element → written to disk.

### Fix implemented
- **Bug A:** raw-block serialization now appends `;` to declaration children
  (`css.ts`, the `classification.kind === 'raw'` branch).
- **Bug B:** new `parseCssLenient` — strict parse on the fast path, and on a
  syntax error it re-parses each top-level block independently, keeping the
  ones that succeed. A malformed block now loses only its own declarations;
  the rest of the page is unaffected. This also **recovers existing
  malformed files** (e.g. the user's snapshots): they load with only the bad
  hover blocks dropped, and re-save clean once Bug A re-emits valid CSS.

Both are covered by `test/styleLossRegression.test.ts`.

### Additional hardening (rename resilience + agent guidance)
- **Code:** `parseCode` now resolves each element's CSS class by exact name
  first, then falls back to the CSS class sharing its stable 4-char hex id
  (`parseCode/index.ts`, `resolveClassName` + `indexCssClassesByIdSuffix`).
  So a class renamed on only one side (TSX vs CSS) — e.g. the
  `api_grid_a201` ↔ `api_wrap_a201` desync found in the real project — no
  longer drops that element to defaults; it recovers the styles and
  re-emits under the TSX-side name. Ambiguous hex ids (shared by two
  classes) intentionally don't fall back. Exact matches (the normal case)
  are untouched — zero round-trip regression.
- **Agent guidance:** both `agent.md` templates now (a) tell agents to
  rename a class in BOTH files in one edit, (b) explain that element states
  (`:hover/:focus/:active`) on the element's own class are parsed/editable
  while cross-element interaction selectors are verbatim-only, and (c) fix a
  stale line that claimed `:hover` etc. were never parsed.

### Recovery for the affected project
After this fix, restoring a pre-corruption snapshot (e.g.
`snap_395bd4907f86`) will load correctly — the lenient parser tolerates the
malformed hover blocks, and saving re-emits them valid. The already-collapsed
disk/`snap_f18a55705cd8` (341 lines) is not auto-repaired; restore an earlier
snapshot instead.

---

## Summary

On a project that contains agent/external-authored CSS, editing a value in the
**Properties → CSS mode** editor causes **every** canvas element to collapse to
`DEFAULT_RECT_STYLES` (`position: absolute; left: 0; top: 0; 100×100`). The loss
is written to disk, so it survives page switches, project reopen, and is copied
into subsequent snapshots. `Cmd+Z` appears to fix it (the in-memory undo stack
predates the collapse) but disk is already overwritten.

Root cause is a **`generateCode → parseCode` round-trip violation**: the CSS-mode
editor is the only common user action that forces a *full re-parse of the file
from disk and a wholesale replacement of the element tree*, and `parseCode`
silently drops styling for constructs it can't map back to a typed element.

User-confirmed facts (2026-06-19):
- Editor used: **Properties → CSS mode** (per-element raw-CSS editor).
- Timing: **only after canvas-editing first**, then a CSS-tab edit triggers it.
- Requested sequencing: **safety guard first, then root-cause fix.**

---

## Symptoms (as reported)

- Agent builds a design → user edits on canvas/visual editor → fine for a while.
- Editing a value from the CSS tab → all elements lose styling, revert to
  `position: absolute; left: 0px; top: 0px`.
- `Cmd+Z` recovers; but changing pages and back loses it again; closing and
  reopening loses it again.
- Several snapshots have also lost the styles; going back far enough (to an
  agent-era snapshot) recovers styling but loses all manual edits in between.

---

## Root cause — the causal chain

Confirmed by code inspection; file references inline.

1. **CSS-mode edit forces a full re-parse (by design).**
   The CSS editor commits via a patch: `CssPanel` → `savePatch`
   (`src/renderer/src/syncBridge/writeDispatch.ts`) → main `patchFile` →
   `patchClassBlock` (`src/shared/patchClass.ts`), which edits **one** class
   block. That write is registered with **`suppressChanged: false`**
   (`src/main/ipc/file.ts:54`), so the watcher deliberately re-broadcasts
   `file:changed` (intent: let the canvas refresh after a raw-CSS edit).
   The renderer's external-edit handler then runs `parseCode` on the **whole
   file** and calls `reloadElements(parsed.elements)`
   (`src/renderer/src/syncBridge/externalEdit.ts:70`, `:123`), replacing the
   entire in-memory element tree.

   > This is the key asymmetry: canvas edits mutate typed state and write
   > *outward* (never re-parse from disk). A CSS-mode edit is the one action
   > that reloads *inward* from disk — so it's the only one exposed to parse
   > fidelity gaps.

2. **`parseCode` silently falls back to defaults on unmatched classes.**
   At `src/renderer/lib/parseCode/index.ts:176`:
   ```ts
   let decls = parsedCss.byClass.get(raw.className) ?? [];
   ```
   If an element's `className={styles.X}` (extracted in `parseCode/tsx.ts`)
   has no matching **base** class block in `byClass`, the element receives an
   empty declaration list → `applyDeclarations(baseline, [])` → only
   `DEFAULT_RECT_STYLES` (`src/renderer/lib/parseCode/apply.ts`,
   `src/renderer/lib/defaults.ts`). Selectors that aren't a bare
   `.class` — **compound** (`.a, .b {}`), **descendant** (`.a .b {}`), or any
   non-base shape — are classified as `raw` in
   `src/renderer/lib/parseCode/css.ts` and **never populate `byClass`**, so the
   affected elements collapse to defaults.

3. **The collapse is persisted to disk.**
   `state.elements` is now the stripped tree. The next canvas edit — or the
   quiet-window reconcile (`src/renderer/src/syncBridge/quietReconcile.ts`) —
   runs `generateCode(state.elements)` and `writeIfDirty`
   (`src/renderer/src/syncBridge/writeIfDirty.ts`) overwrites the file. The good
   agent CSS is now gone from disk.

4. **Everything downstream follows from the disk being corrupted.**
   - `Cmd+Z` restores the pre-collapse *in-memory* elements (undo stack), so it
     looks fixed — disk is not.
   - Page switch / reopen re-parse the corrupted disk → styles gone again
     (`useActiveTarget.ts` load path).
   - Auto-save (2-min) and `agent_edit` snapshots copy **from disk**
     (`src/main/ipc/snapshotOps.ts`), so any snapshot taken after the bad write
     captures stripped CSS. Only pre-corruption snapshots are clean — which is
     why recovery required jumping back to an agent-era snapshot and losing the
     manual edits since.

### Why "only after canvas edits first" matters

Because canvas edits write scamp's *own* `generateCode` output to disk, the file
that gets re-parsed on the CSS-tab edit is scamp-generated — not raw agent text.
So **`generateCode` is emitting a construct that `parseCode` cannot read back**:
the round-trip is not the identity it's required to be. The agent seeds a
construct (compound/descendant selector, a class name that doesn't match the TSX
reference, a `customProperties`/raw block, an `@media`/`@keyframes` shape) that
`generateCode` preserves on the way out but `parseCode` drops on the way back in.

This narrows the root-cause fix to: **find the construct(s) where
`generateCode → parseCode` is lossy, and close the gap** — while the safety guard
ensures a lossy parse can never again destroy on-disk data.

---

## Open question (blocks Phase 0)

The exact losing construct in *this* project isn't pinned. Fastest path: the
**agent-authored `.tsx` + `.module.css`** for one affected page (or a minimal
slice). With it, Phase 0 is a one-shot failing test. Without it, I'll construct
candidate repros from the known gaps (compound selectors, descendant selectors,
semantic class names, `@media`, `@keyframes`, `customProperties`) until one
reproduces.

---

## Fix plan (safety guard first, per request)

### Phase 0 — Reproduce with a failing test
- Build a unit/integration test that mirrors the real sequence:
  agent CSS → `parseCode` → `generateCode` (simulated canvas edit, written to
  "disk") → simulated CSS-mode patch (`patchClassBlock`) → `parseCode` again →
  **assert no element collapsed to defaults** and styling is preserved.
- This both proves the diagnosis and becomes the regression gate.

### Phase 1 — Safety guard (stop the bleeding) — independent of root cause
The guard keys on **round-trip fidelity**, so it protects against *every* parse
gap, known or not:

1. **Non-destructive reload.** Before `reloadElements(parsed.elements)` in the
   external-edit path, verify the parse is faithful: regenerate from
   `parsed.elements` and compare against the CSS just read from disk. If it
   diverges in a style-dropping way (the parse is lossy), **do not replace the
   tree** — keep the current good in-memory state and surface a non-blocking
   warning ("this file has CSS scamp can't fully represent; canvas not updated
   to avoid data loss"). Because `state.elements` stays good, step 3's overwrite
   never regenerates a stripped file.
2. **Write-time backstop.** In `writeIfDirty`, refuse to overwrite a file whose
   regenerated output would strip styling from many elements relative to the
   on-disk baseline, unless that change is attributable to an explicit user edit
   on those elements. Treat it as a conflict (keep disk) rather than silently
   clobbering.
3. **Snapshot guard.** Don't let a suspicious (guard-tripped) state trigger an
   `auto_save`/`agent_edit` snapshot, so a near-miss can't poison history.

> Net effect after Phase 1: a CSS-tab edit on a not-yet-supported construct
> stops updating the canvas and warns, instead of destroying the file. No data
> loss; worst case is "edit not reflected."

### Phase 2 — Root-cause parse fidelity
- Make `parseCode` **non-destructive on unmatched classes**: an element whose
  class block isn't found should retain its prior styling / route the unmatched
  body to `customProperties` or a preserved raw block — never silently fall to
  `DEFAULT_RECT_STYLES`.
- Handle **compound** and **descendant** selectors without stripping the base
  element's declarations (parse the base portion; preserve the rest as raw).
- Re-establish the **`generateCode → parseCode` identity** for whatever
  construct Phase 0 surfaces.

### Phase 3 — Fidelity corpus + hardening
- Add an **agent-authored CSS test corpus** (semantic class names, compound and
  descendant selectors, `@media`, `@keyframes`, `customProperties`, mixed
  shorthand/longhand) asserting `parse → generate` and `generate → parse` lose
  no styling.
- Add a guard test: a CSS-mode edit on agent CSS never zeroes any element.
- Consider widening the round-trip invariant test beyond the scaffold.

---

## Test strategy
- `parseCode` / `generateCode` are pure (`src/renderer/lib/`) — test the
  round-trip directly, no app launch. This is mandated coverage per CLAUDE.md.
- Integration test for the patch path: real temp dir, `patchClassBlock` + the
  reload-fidelity guard, asserting disk is never overwritten with stripped CSS.
- One e2e covering the real user flow (agent CSS on disk → canvas edit → CSS-mode
  edit → styles intact) once Phases 1–2 land.

## Recovery guidance for the affected project
- Snapshots **before the first bad write** are intact; snapshots after it are
  poisoned. The cleanest pre-corruption snapshot is the recovery point (at the
  cost of manual edits made after it — already experienced).
- If a session is still open with the styling visible (undo stack alive), avoid
  page switches / CSS-tab edits and we can attempt to re-emit the good state to
  disk before it's lost.

## Risks / non-goals
- Phase 1's fidelity check adds a parse+generate per external reload — negligible
  vs. the data-loss risk; only runs on the reload path, not per keystroke.
- Not in scope: redesigning the CSS-mode editor to apply per-element without a
  full reload (a cleaner long-term direction, but larger than this fix).
