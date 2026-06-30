# Anchor Links and Element IDs — Plan

**Status:** Draft for review (follow-up to linking-between-pages).
**Date:** 2026-05-04
**Source:** Out-of-scope item flagged in
`docs/plans/2026-05-04-linking-between-pages.md` Q7.
**Related:** Linking between pages (in-flight or shipped),
preview mode (#5, shipped).

## Goal

Let users link to a specific section of a page (`/about#contact`,
`#section-id` within the same page) the same way they link to
pages — via the Link section's destination dropdown. To do that,
elements need user-assignable HTML `id` attributes that survive
round-trips and are visible in the canvas / layers panel.

This is the natural follow-up to "linking between pages" because
the linking UI already exists; this plan extends the destination
picker with per-page anchor targets.

---

## What's missing today

`ScampElement.attributes` already round-trips arbitrary attributes
including `id`, but:

1. There's no UI to set an `id` from the panel — users have to drop
   into the raw `attributes` editor or hand-edit the file.
2. The Link section (from the linking-pages plan) only knows about
   pages, not about anchor targets within a page.
3. The canvas doesn't surface which elements have `id`s, so
   anchors are invisible until you're hand-writing CSS / JS that
   references them.
4. There's no validation that an `id` is unique within a page (a
   real CSS / a11y requirement).

---

## Decisions worth flagging up front

### `id` is a typed first-class field on `ScampElement`

Today it'd live in `attributes.id`. Promote it to a typed
`elementId?: string` field (renamed to avoid clash with Scamp's
internal `ScampElement.id` which is the 4-char hex). This buys:

- Validation on patch (uniqueness within a page, valid HTML id
  syntax) without scanning the attribute bag.
- Cheap "list of anchor targets in page X" lookup for the Link
  section's dropdown.
- A clear panel field next to Name (which is the layers-panel
  label) so users understand the difference: Name is design-time,
  `id` is runtime HTML.

Old projects with `attributes.id` migrate on parse — the parser
moves the value out of the attribute bag into `elementId` if
present.

### `id` is editable from the Element section

A new "HTML id" text input in the Element section (just below the
Name field). Empty = no id emitted. Validation:

- Allowed chars: ASCII letters, digits, `-`, `_`. (HTML5 allows
  more but those are the practical/portable subset.)
- Must not start with a digit.
- Must be unique within the current page (across all elements).
- Empty is fine.

Validation errors show inline; the patch is rejected if the id is
invalid OR collides with another element on the same page. We
don't auto-suffix to dedupe — explicit user fix is correct.

### The Link section gains per-page anchor targets

The destination dropdown grows a third level when "Page" is
selected:

```
Link to:    [ Page  ▾ ]
            [ About  ▾ ]
            [ # (top of page)  ▾ ]   ← new
              ├ # (top of page)
              ├ #contact-form
              ├ #pricing-table
              └ #faq
```

The third dropdown lists every element in the destination page
that has an `elementId` set, prefixed with `#`. Plus an implicit
"# (top of page)" option that emits no fragment (`href="/about"`).

Same-page anchors (no destination page change) get a special UI:

```
Link to:    [ Same page  ▾ ]
            [ #contact-form  ▾ ]
```

Selecting Same page restricts the third dropdown to the current
page's anchor targets. The emitted href is `#contact-form` — no
absolute path.

### Anchor scrolling Just Works in preview

Browsers natively scroll to `#fragment` on navigation. Next.js's
client router handles intra-page navigation too. No special
preview-mode wiring needed.

### Canvas anchor indicator

Elements with an `elementId` set get a small `#` badge in the
top-left corner (mirror of the link indicator's top-right
position). Tooltip: `id="contact-form"`. Click → ... nothing for
now (out of scope: jump-to-element-by-id navigation).

---

## What changes in the model

### `ScampElement`

Add one field:

```ts
export type ScampElement = {
  // ...
  /**
   * Optional HTML `id` attribute. Free-form string but validated on
   * write to be a portable id (ASCII letters / digits / `-` / `_`,
   * not starting with a digit) and unique within its page. Emitted
   * verbatim as `id="..."` in the TSX. Anchor links from other
   * elements (same page or cross-page) reference this id.
   *
   * Distinct from `ScampElement.id` (the 4-char hex internal id) —
   * `elementId` is the runtime HTML id the user controls.
   */
  elementId?: string;
  // ...
};
```

### Generator

`renderJsx` emits `id="<elementId>"` after `data-scamp-id` and
before `className`. Order chosen so id is visually prominent in
the source.

### Parser

`parseTsxStructure` already collects every attribute; promote `id`
out of the generic attribute bag into `elementId` when present.
Empty / missing → field undefined.

### Page-level uniqueness validation

A small `src/renderer/lib/elementIds.ts` with:

- `validateElementIdFormat(value: string): { ok: true } | { ok: false; reason: string }`
- `findElementIdCollision(elements, candidate, ignoreElementId): string | null`
  — returns the hex id of the colliding element if any.

Patch handlers reject invalid / colliding ids before they land in
the store. The properties panel surfaces the rejection inline.

### Link section additions

- Same-page vs. external-page destination toggle.
- Anchor dropdown populated from the destination page's element
  tree (when "Page" selected) or the current page's tree (when
  "Same page" selected).
- Anchor emission: appended to the path as `#<id>`.

### Page-rename href refactor extends to anchors

When a page is renamed (the linking-pages plan's `pageRename`
extension), the regex needs to handle the `#fragment` suffix:

```
href="/old"       → href="/new"
href="/old#anchor" → href="/new#anchor"
href="/old/sub#anchor" → href="/new/sub#anchor"
```

The current plan's regex pattern `\bhref\s*=\s*"/<old>(/[^"]*)?"`
already handles the trailing-slash case; widen the capture to
include `#` content too.

### Element rename → anchor refactor (NEW concern)

If a user renames an element's `elementId` from `contact` to
`contact-form`, every `href` referencing `#contact` should update.
Same regex sweep as page rename, but anchor-scoped. Trickier
because:

- Anchors are unscoped within a page in CSS/HTML — `#contact` could
  refer to multiple elements across pages, but the same id
  collision validation prevents within-page duplicates.
- A `href="#contact"` (same-page) refactor is unambiguous.
- A `href="/about#contact"` refactor only applies if we're
  renaming an id on the About page.

Implementation: when an `elementId` changes, the canvas store
notifies a small refactor helper that walks every TSX, finds
`href="<self-page>#<old>"` and `href="#<old>"` (within the same
page only) and rewrites. Same `pendingWrites` suppression.

---

## Implementation phases

### Phase 1 — `elementId` typed field + parser/generator

1. Add `elementId?: string` to `ScampElement`.
2. Generator emits `id="..."` between `data-scamp-id` and
   `className`.
3. Parser promotes `id` out of `attributes` into `elementId`.
4. `cloneElementSubtree` clears `elementId` on clones (an `id`
   must be unique, so cloning would create a collision — caller
   re-assigns explicitly if they want).
5. Tests in `test/elementId.test.ts`:
   - Round-trip with id set.
   - Old `attributes.id` migrates to `elementId` on parse.
   - Clone clears `elementId`.

**Acceptance:** typed field round-trips; old projects with raw
`id=` attributes don't lose data.

### Phase 2 — Validation helpers

1. `src/renderer/lib/elementIds.ts` with `validateElementIdFormat`
   and `findElementIdCollision`.
2. Tests for both — every legal/illegal char class, collision
   detection across the tree, ignore-self handling.

**Acceptance:** pure helpers, fully tested.

### Phase 3 — Element section "HTML id" field

1. Extend `ElementSection.tsx` with the id text input below Name.
2. On change, validate format; on blur (or commit), check
   collision.
3. Inline error UI for both failure modes.
4. Patch only fires when the value is valid + unique.

**Acceptance:** users can set an id from the panel; collisions and
malformed ids are blocked with a clear message.

### Phase 4 — Canvas anchor indicator

1. New `AnchorIndicator.tsx` next to `LinkIndicator.tsx` —
   identical visual pattern but `#` badge in top-left corner.
2. Mount inside `CanvasInteractionLayer.tsx` for every element
   with `elementId` set.
3. Tooltip: `id="<value>"`. No click action (yet).

**Acceptance:** elements with ids show the badge; the badge updates
live as ids are added/removed.

### Phase 5 — Link section: anchor target dropdown

1. Restructure the destination dropdown into a three-level picker
   when "Page" is selected: external/same-page → page → anchor.
2. New "Same page" top-level option that pins the second dropdown
   to the current page and emits a fragment-only href
   (`href="#contact"`).
3. Anchor list populated from the destination page's `elementId`s
   — needs a selector (or IPC) that returns the list of ids per
   page from the project data.
4. URL emission: `/<page>#<id>` for cross-page;
   `#<id>` for same-page.

**Acceptance:** anchor dropdown lists every id'd element on the
target page; selecting one writes the right href; "Same page" mode
emits fragment-only hrefs.

### Phase 6 — Refactor href on page rename + element id rename

1. Extend the linking-pages plan's `pageRename` href regex to
   capture the `#fragment` suffix and re-emit it after the new
   slug.
2. New `elementIdRename` helper triggered when an element's
   `elementId` changes. Walks the OWNING page's TSX (and only that
   one) rewriting `href="#<old>"` and
   `href="/<own-page>#<old>"` to the new id.
3. Cross-page anchor refs (from other pages to the renamed
   element) ALSO get refactored — walk every TSX file once per
   id rename.
4. Suppress writes via `pendingWrites`.
5. Integration tests for both rename flows.

**Acceptance:** renaming a page or an element's id refactors every
anchor reference in the project.

### Phase 7 — Polish + docs

- `agent.md`: document the `id="..."` convention and the anchor
  href forms (`/page#anchor`, `#anchor`).
- Validation rules in panel tooltips.
- Backlog entry: "click anchor indicator to scroll-to-element on
  the canvas" — defer.

---

## Files changed (anticipated)

| File | Change |
|---|---|
| `src/renderer/lib/element.ts` | Add `elementId?: string` to `ScampElement`. Clear it in `cloneElementSubtree`. |
| `src/renderer/lib/elementIds.ts` | NEW — `validateElementIdFormat`, `findElementIdCollision`. |
| `src/renderer/lib/generateCode.ts` | Emit `id="..."` in `renderJsx` when `elementId` set. |
| `src/renderer/lib/parseCode.ts` | Promote `attributes.id` into `elementId` on parse. |
| `src/renderer/src/components/sections/ElementSection.tsx` | Add HTML id text input + validation UI. |
| `src/renderer/src/components/sections/LinkSection.tsx` | Anchor target dropdown; "Same page" destination kind; href emission with fragment. |
| `src/renderer/src/canvas/AnchorIndicator.tsx` | NEW — `#` badge overlay. |
| `src/renderer/src/canvas/CanvasInteractionLayer.tsx` | Mount AnchorIndicator. |
| `src/main/ipc/pageRename.ts` | Widen href regex to preserve `#fragment` suffix on rename. |
| `src/renderer/store/canvasSlice.ts` | Trigger element-id rename refactor when `elementId` changes. |
| `src/main/ipc/elementIdRename.ts` (or extend pageRename) | NEW — walk TSX files rewriting anchor refs. |
| `test/elementId.test.ts` | NEW — round-trip, migration, clone. |
| `test/elementIds.test.ts` | NEW — validation + collision helpers. |
| `test/integration/anchorRefactor.integration.test.ts` | NEW — page rename + element-id rename refactor anchors. |
| `src/shared/agentMd.ts` | Document the id and anchor href conventions. |

---

## Open questions (please review before implementing)

**Q1. Promote `id` to a typed field, or leave in `attributes` bag?**
Plan: typed `elementId` field. Buys validation, fast lookup for the
anchor dropdown, and a clear panel-field distinction from Name.
Cost: schema migration for old projects. My pick: **typed**.

**Q2. Validation strictness — ASCII subset or full HTML5 syntax?**
Plan: ASCII letters/digits/`-`/`_`, no leading digit. HTML5 allows
much more (`:`, `.`, Unicode, etc.) but those break CSS selectors
and JS APIs. My pick: **ASCII subset**, with a clear error message
for the invalid cases.

**Q3. Collision handling — block, auto-dedupe, or warn?**
Plan: block the patch. The user explicitly retypes. Alternative:
auto-suffix (`contact` → `contact-2`) silently. My pick: **block**
— silent renames are surprising, and collisions are usually
copy-paste accidents the user wants to fix consciously.

**Q4. Element rename refactors anchor refs — automatic or opt-in?**
Plan: automatic, same as the page rename refactor (Q5 of the
parent plan). Alternative: prompt "X links reference #old —
update? [Y/N]". My pick: **automatic** for consistency with the
page-rename behaviour.

**Q5. Anchor dropdown scope — id'd elements only, or every element?**
Plan: only elements with `elementId` set. Linking to a
nameless element doesn't make sense — the anchor needs an HTML id
to scroll to. My pick: **id'd only**, with a hint in the dropdown
when there are no id'd elements: "Add an id to elements you want
to link to."

**Q6. "Same page" vs. always emit absolute paths?**
Plan: support both (`#anchor` and `/about#anchor`). Same-page
anchors are common (TOC links, "back to top" buttons). Browsers
treat both identically once on the same page, but same-page emit
is cleaner. My pick: **support both** with the dropdown's
"Same page" toggle picking the form.

---

## Out of scope

- **Click-anchor-indicator-to-scroll-canvas-to-element.** Useful
  but separate. Belongs in a "canvas navigation" follow-up.
- **`tabindex` and other a11y attributes.** Same panel surface
  could host them; defer.
- **`name` attribute (legacy anchor target).** Modern HTML uses
  `id`; `name` on `<a>` is deprecated for anchor purposes. Skip.
- **Auto-id generation.** Some tools auto-generate ids from
  Name (`Hero Card` → `hero-card`). Skipped — explicit user
  control matches the rest of Scamp.
- **External anchors.** `href="https://example.com#section"`
  already round-trips via the External URL field; no special
  anchor UI for external destinations.

---

## Risks

- **Schema migration on parse.** Old projects with
  `attributes.id` need a one-time promotion to `elementId`. If a
  user has multiple `id`s on different elements (a hand-edit) the
  promotion happens per-element and the page-uniqueness check
  may flag collisions on first open. Mitigation: surface flagged
  collisions in the panel rather than auto-fixing; first-open
  behaviour is identical to what the user wrote.
- **Anchor refactor false positives.** A string literal in TSX
  containing `#contact` could be mistaken for an anchor href.
  Same risk as the page-rename refactor in the parent plan;
  mitigation is the same: anchor the regex to attribute syntax.
- **Cross-page anchor refactor cost.** Renaming a frequently-
  referenced anchor walks every TSX file in the project. For
  projects with many pages this could be a noticeable pause.
  Acceptable for the POC (projects are small); revisit if it
  becomes a complaint.
- **Collision validation is per-page, not per-project.** Two
  pages can both have an element with `id="contact"` — that's
  fine in HTML (each page is its own document). The validator
  only checks within the current page. Make this clear in the
  panel error message ("This id is already used in this page" —
  not "in this project").
