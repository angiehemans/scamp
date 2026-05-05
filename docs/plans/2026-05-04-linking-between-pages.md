# Linking Between Pages — Plan

**Status:** Draft for review.
**Date:** 2026-05-04
**Source:** `docs/backlog-3.md` story #6.
**Related:** Preview mode (#5, shipped — links need a real browser to
be useful), Next.js file structure (shipped — pages live at
`app/<name>/page.tsx`, routes are `/<name>`).

## Goal

Any element can link to another page in the project, or to an
external URL. Clicking the link in preview navigates the preview
window (internal) or opens the system browser (external). The canvas
shows a small chain icon so linked elements are visible at a glance.

The user picks the destination from a **dropdown of the project's
pages**, not by hand-typing `href="/dashboard"`. Page renames
auto-update href references; deleted-page references show a
broken-link warning.

---

## What already exists

Today, a user can pick `<a>` from the tag dropdown in the Element
section and type a free-form `href` and `target`. That works but is
clunky and easy to break — the user has to know to swap the tag
themselves, and there's no awareness of what pages exist.

This plan adds a dedicated **Link** section that does the right
thing for the common cases (link to another page, open in new tab)
without the user having to think about HTML tags.

---

## Decisions worth flagging up front

### Both Convert (tag-swap) AND Wrap, with a sensible per-tag default

The story originally proposed always wrapping non-`<a>` elements in
an `<a>` parent. Wrapping every link, even on plain `<div>`s, adds
unnecessary nesting and a second class to manage. But always tag-
swapping breaks legitimate cases like `<a><img></a>` (you can't
change an `<img>` into an `<a>` without losing the image) and
`<a><article>...</article></a>` (where the article semantic is the
whole point).

So the panel offers **both options** with a per-tag default:

| Current tag | Default action | Other option |
|---|---|---|
| `<div>`, `<span>`, `<p>`, `<button>` | **Convert** (swap to `<a>`) | Wrap |
| Semantic block tags (`<article>`, `<section>`, `<header>`, `<nav>`, `<aside>`, `<main>`, `<footer>`, `<figure>`) | **Wrap** (insert `<a>` parent) | Convert |
| Self-contained content (`<img>`, `<video>`, `<iframe>`, `<svg>`, `<input>`, `<textarea>`, `<select>`) | **Wrap** only | — |
| Already `<a>` | (no prompt — link is set directly) | — |

`<button>` lands in the Convert column deliberately: a "button that
navigates" is canonically `<a>` styled to look like a button, not a
literal `<button>` inside an `<a>` (which is technically invalid
HTML — interactive content nested in interactive content). The user
who wants to preserve a literal `<button>` for their own reasons can
still pick Wrap from the alternate option.

When the user enables linking on a non-`<a>` element, the Link
section shows:

```
ⓘ This element is a <div>. To make it a link:
  [ Convert to <a> ]   [ Wrap in <a> ]
```

The default-recommended action is bolded; the other is offered as a
secondary affordance. Picking either writes the patch in one shot
(no intermediate broken state). For the wrap-only tags, only the
Wrap button shows.

### Wrap creates a real Scamp element, not an inline JSX fragment

When the user picks Wrap, Scamp inserts a new element with
`tag: 'a'` and the `href` (+ `target` / `rel`) on its attribute bag,
then reparents the current element under it. Same tree-manipulation
primitive as `groupSiblings` (which we already have for flex
grouping) — generalised to "wrap a single element in a new parent."

This keeps both elements as first-class Scamp elements visible in
the layers panel, and `generateCode` / `parseCode` round-trip the
result without any new logic — the wrapping `<a>` is just an
element with children.

The wrapping `<a>` gets `customProperties.display = 'block'` at
creation so a wrapped block-level child still renders as a block
(default `<a>` is inline). The user can override the display to
`contents` (no rendering box), `inline-block`, or anything else
from the panel later — no Scamp-side magic.

### Unlink also branches

Removing a link mirrors the entry path:

- **Linked element is `<a>` (Convert path or user-authored)**:
  "Unlink" clears `href`, `target`, `rel`. Tag stays `<a>` (the
  user can swap back from the tag dropdown if they want).
- **Linked element has an `<a>` parent created by Wrap**: "Unlink"
  offers two buttons — **"Clear href (keep wrapper)"** and
  **"Remove `<a>` wrapper"**. The second uses the existing
  `ungroupSiblings` primitive to dissolve the parent and reparent
  the child up to the grandparent. We don't auto-detect "Scamp-
  created wrapper vs. user-authored `<a>` wrapper"; both are just
  `<a>` elements with children, and the user gets the same
  affordance regardless.

### `<a>` everywhere, not `<Link>` from `next/link`

Next.js's `<Link>` gives client-side routing (fast page transitions,
prefetching) but adds an import to manage at the top of every TSX
file. Plain `<a href="/dashboard">` does a full page reload in
`next dev` — slower than `<Link>`, but still well under a second on
a local dev server. For a prototype tool, the simplicity of "the
href is the truth, no special component" wins.

Future polish could upgrade to `<Link>` (a `next/link` follow-up
plan) but the data model wouldn't change.

### `href` lives in `attributes.href`, no new typed field

`ScampElement.attributes` already round-trips `href`, `target`, and
arbitrary attribute keys. The Link section reads / writes
`attributes.href` and `attributes.target` directly — no new field
on `ScampElement`. The only computed thing is the **kind** of link
(internal page / external URL / broken page reference), which the
panel derives from the href string at render time.

This keeps the data model lean and makes round-trips trivial:
generated TSX is `<a href="/dashboard" data-scamp-id="…">` and the
parser already routes that into `attributes.href`. No generator or
parser changes needed for the data layer.

### Internal links use absolute paths (`/dashboard`)

Next.js App Router routes are absolute. The home page is `/`; a
page at `app/dashboard/page.tsx` is `/dashboard`. The dropdown emits
`/<page-slug>` (or `/` for home). Easier than relative paths and
matches Next conventions.

### "Open in new tab" sets `target="_blank"` AND `rel`

Modern browsers require `rel="noopener noreferrer"` on
`target="_blank"` links to prevent `window.opener` exploits. The
toggle writes both attributes; clearing the toggle removes both.
Out-of-band manual edits to `rel` round-trip via the attribute bag
unchanged.

### External link detection is structural, not stored

The panel decides "internal vs external" by parsing the href:

- Starts with `/` → internal page reference. Look up matching page
  in the project; if found, dropdown shows that page selected. If
  not, show as **Broken** (red badge).
- Starts with `http://` / `https://` / `mailto:` / `tel:` → external.
  Show in the External URL field.
- Anything else (`#anchor`, relative paths, JS expressions) → show
  as raw text in a fallback "Custom href" field. Doesn't try to
  interpret.

No new state to keep in sync — the link kind is derived on every
render.

### Page rename refactors href references

When the user renames a page (existing `pageRename.ts` IPC), Scamp
walks every TSX file, finds `href="/<old-slug>"` and `href="/<old-
slug>/..."`, rewrites to the new slug. Touches CSS modules zero,
TSX as needed. Matches the agent-friendly-sync atomic write pattern
(write all changes before the watcher fires).

---

## What changes in the model

**Nothing in `ScampElement`.** `attributes.href`, `attributes.target`,
and `attributes.rel` are already in the bag.

**`ProjectData.pages` flows down to the Link section.** Currently
`ProjectShell` has the pages but doesn't expose them to deep
property-panel components. Add a small selector or context so the
Link section can render the page dropdown without prop-drilling.

**One new tree primitive: `wrapElement`.** Generalises
`groupSiblings` for the single-element case — takes one element id
and a partial new-parent template, returns a new map with the
element reparented under a freshly-created Scamp element. Lives in
`src/renderer/lib/element.ts` next to `groupSiblings` /
`ungroupSiblings`. Pure, fully tested.

**No generator changes.** The generator already emits `<a href="…"
target="…" rel="…">` from the attribute bag, and already handles
arbitrary parent/child nesting. As long as the user's edits land in
the bag (or in a new wrapping element), the file output is correct.

**No parser changes.** Same — `href`/`target`/`rel` round-trip via
the existing attribute-bag path; a wrapping `<a>` parses back into
a Scamp element with children via the existing TSX walk.

---

## What changes in the UI

### A new "Link" section in the properties panel

Sits between the Element section and the Layout section. Visible
for every element regardless of tag (so the user can add a link to
a `<div>` without first knowing they need an `<a>`).

```
Link
─────────────────────────────────
Link to:    [ Page  ▾ ]   ← dropdown: Page / External URL / None
            [ Home  ▾ ]   ← second dropdown when "Page" selected:
                           lists all pages in the project + "Broken"
                           label if href points at a missing page
                           
Open in new tab  [ ☐ ]
```

When **"External URL"** is selected, the second dropdown is replaced
by a text input:
```
URL:       [ https://example.com  ]
```

When **"None"** is selected (no href), the rest of the section is
hidden. Selecting None on an element that currently has a link
clears `href`, `target`, and `rel`.

### "Convert / Wrap" affordance

When the user picks a destination on a non-`<a>` element, the
panel shows the two-button prompt described above (Decisions §
"Both Convert AND Wrap"). The recommended default for the current
tag is bolded; the alternate is offered as a secondary action. For
self-contained content (`<img>`, etc.), only the Wrap button shows.

Crucially: **the user must pick** before the href is written. We
don't silently write `href="..."` to a `<div>` (which would create
invalid HTML that does nothing in the browser). The Link section
shows the destination dropdowns disabled until the user has either
made the element an `<a>` (via the panel's Convert action), or the
wrapping `<a>` exists. The exception is when the element is already
`<a>` — the dropdowns are live immediately.

### Canvas link indicator

When an element's `attributes.href` is set, render a small chain-
link icon overlay in the element's top-right corner (similar to how
selection handles render today — overlay layer above the canvas
content). Two visual states:

- **Linked** — blue chain icon. Tooltip: "Links to /dashboard"
  (or the URL for external).
- **Broken** — red chain icon with a slash. Tooltip: "Links to
  /old-page (page not found in this project)".

Clicking the icon in **Select mode** navigates the canvas to the
linked page (only for internal links — external links open in the
system browser via `shell.openExternal`). The icon needs its own
hit area distinct from the element so selecting the element
doesn't trigger navigation.

### Canvas-side broken-link detection

The icon's broken-state check just compares the parsed page slug
against `useCanvasStore(s => s.pageNames)` (or the equivalent
selector). No persistent state, no extra IPC.

---

## Preview-mode integration

### Internal links — already work

Plain `<a href="/dashboard">` triggers a normal browser navigation
in the preview's webview. The webview's `did-navigate` handler
already updates the toolbar URL and back/forward state. No changes
required.

### External links — open in system browser

Today the preview window allows popups (`allowpopups` on the
webview) which means `target="_blank"` opens a new Electron
BrowserWindow. We don't want that — the preview should stay
focused on the project.

Add a `setWindowOpenHandler` on the webview's webContents that:

- Returns `{ action: 'deny' }` for any URL outside the project's
  origin (i.e. anything not on `localhost:<port>`).
- Calls `shell.openExternal(details.url)` so the system browser
  opens it.
- Allows popups for same-origin URLs (project pages opening
  themselves in a new tab — rare but harmless).

This needs to wire into the webview AFTER the dev server is ready
and the webview has a `webContents` to attach to. The existing
`PreviewApp.tsx` knows the port from the status payload — pass it
through to the IPC handler that attaches the window-open handler.

Alternative: have the renderer intercept clicks via a content
script. Less robust (script injection across origins is finicky in
webview); main-process handler is the right hook.

### Auto-follow page switches in canvas (already deferred)

The story says links work in preview without user intervention.
That's true — but only after the user navigates manually inside the
preview. The "auto-follow" feature (canvas page switch → preview
navigates) is a separate backlog item under Preview-mode follow-
ups. Out of scope here.

---

## Page rename: refactor href references

When `page:rename` runs (`src/main/ipc/pageRename.ts`), today it
moves the page's TSX/CSS/folder. Add a follow-on step:

1. Compute old route slug → new route slug (`/old`, `/new`).
2. For every TSX file in the project (every page's `page.tsx`):
   - Read content.
   - Regex-replace `href="<oldSlug>(/[^"]*)?"` → `href="<newSlug>$1"`.
   - Same for single-quoted form.
   - Write only if content changed.
3. Suppress the resulting file:changed events via the existing
   `pendingWrites` mechanism so the renderer doesn't double-parse.

Keep this strictly attribute-string-replace — don't try to parse
JSX. Risk: false positives on non-link strings that happen to
contain `href="/old"` (a code comment, a string literal). Acceptable
because the regex is anchored to `href="..."` attribute syntax which
is rare outside actual links.

Ship a test file that round-trips: rename home → landing, every
href in every page should reflect.

---

## Implementation phases

### Phase 1 — `wrapElement` tree primitive

1. Add `wrapElement(elements, elementId, parentTemplate)` to
   `src/renderer/lib/element.ts`. Mirrors `groupSiblings` but for
   one child:
   - Validates: not the root, parent exists.
   - Generates a fresh id; creates a new element with the supplied
     template fields (tag, attributes, customProperties); inserts
     it into the parent's `childIds` at the original element's
     index; reparents the original element under the new wrapper.
   - Returns `{ elements, wrapperId }` or `null` on validation
     failure.
2. Tests in `test/wrapElement.test.ts`:
   - Wraps a non-root element under a fresh `<a>` parent with the
     given href; tree shape correct; original element's id and
     children preserved.
   - Refuses to wrap the root.
   - Round-trip via generateCode → parseCode preserves the wrap.

**Acceptance:** the primitive is pure, tested, and round-trip safe.

### Phase 2 — Link section UI (no rename, no canvas icon)

1. New `LinkSection.tsx` in `src/renderer/src/components/sections/`.
   Renders the dropdown / URL input / new-tab toggle.
2. Reads pages from a new selector `useProjectPages()` (or
   equivalent) — exposes `ProjectData.pages` to the panel.
3. Writes patches via the existing patch IPC:
   - For an element whose tag is already `a`: write
     `attributes.href` (+ `target` / `rel`) directly.
   - For non-`<a>`: render the Convert / Wrap two-button prompt.
     - Convert → set `tag = 'a'` + write href in one patch.
     - Wrap → call the canvas store action that uses
       `wrapElement` to create a new `<a>` parent with href, then
       writes one sync patch covering the whole tree change.
4. Per-tag default action selection (which button is bolded)
   per the table in Decisions.
5. Unlink branch logic:
   - On `<a>` (no Wrap parent): single Unlink button clears href.
   - On a child of a Scamp `<a>` parent: two buttons — Clear href,
     Remove wrapper. Remove uses `ungroupSiblings` (or equivalent
     "unwrap one element" helper).
6. Add to `PropertiesPanel.tsx` between Element and Layout sections.

**Acceptance:** opening any element shows the Link section; picking
a page from the dropdown writes the right href + tag changes;
removing the link returns the tree to its prior state.

### Phase 3 — Canvas link indicator

1. Add a small `LinkIndicator.tsx` overlay component that takes
   `elementId` + `bounds` and renders the chain icon at the
   element's top-right.
2. Mount inside `CanvasInteractionLayer.tsx` (or wherever
   selection handles live) for every element with
   `attributes.href` set.
3. Click handler: parses href, calls `setActivePage(<slug>)` for
   internal links, `window.scamp.openExternal(url)` for external.
4. Styling: blue + chain icon for valid; red + slash for broken
   (page slug not in `pageNames`).

**Acceptance:** linked elements show the icon; broken links show
red; clicking the icon navigates the canvas (internal) or opens
system browser (external).

### Phase 4 — Preview window-open interception

1. Add `webContents.setWindowOpenHandler` on the preview webview
   when its `webContents` becomes available (`did-attach-webview`
   on the host BrowserWindow, or via the webview tag's
   `'dom-ready'` event in the renderer).
2. Handler logic: same-origin → allow; anything else →
   `shell.openExternal` and deny.
3. New IPC if needed (renderer can't reach `shell` directly):
   `preview:openExternal(url)`.

**Acceptance:** clicking an external link in the preview opens the
system browser instead of a new Electron window; clicking an
internal link navigates the webview as normal.

### Phase 5 — Page rename href refactor

1. Extend `pageRename.ts` (after the move-files step) to walk every
   page's TSX, do the href regex-replace, write with pendingWrites
   suppression.
2. Old → new slug computation. Edge cases: home page renames to
   something → `/` becomes `/<new>`; renaming to home → `/<old>`
   becomes `/`. Both directions covered.
3. Integration test in `test/integration/pageRename.integration.test.ts`
   (or new file): seed two pages where one links to the other,
   rename, assert the href is rewritten.

**Acceptance:** renaming a page updates every reference to it in
sibling pages; no orphaned hrefs.

### Phase 6 — Polish + docs

- `agent.md` — note that `<a href="/<page-slug>">` is the link
  convention; agents should use page slug paths, not relative
  paths.
- Update the panel's tooltips so "Open in new tab" explains the
  `rel` attribute auto-added.
- Storybook-ish manual test pages in the dev folder — a project
  with internal + external + broken links to eyeball the indicator
  states.

---

## Files changed (anticipated)

| File | Change |
|---|---|
| `src/renderer/lib/element.ts` | NEW pure helper `wrapElement(elements, id, parentTemplate)` next to `groupSiblings` / `ungroupSiblings`. |
| `src/renderer/store/canvasSlice.ts` | New action `wrapInLinkParent(id, href, options)` calling `wrapElement` + sync write. Surface `pageNames`. |
| `src/renderer/src/components/sections/LinkSection.tsx` | NEW — dropdowns, URL input, toggle, Convert / Wrap two-button affordance, branching Unlink controls. |
| `src/renderer/src/components/PropertiesPanel.tsx` | Mount `LinkSection` between Element and Layout. |
| `src/renderer/src/components/ProjectShell.tsx` | Push `project.pages` slugs into the store on every project change. |
| `src/renderer/src/canvas/LinkIndicator.tsx` | NEW — chain icon overlay. |
| `src/renderer/src/canvas/CanvasInteractionLayer.tsx` | Mount LinkIndicator for every linked element. |
| `src/renderer/preview/PreviewApp.tsx` | Wire window-open interception to the webview. |
| `src/preload/preview.ts` | Expose `openExternal` if not already there. |
| `src/main/previewWindow.ts` | Handle `preview:openExternal` IPC; call `shell.openExternal`. |
| `src/main/ipc/pageRename.ts` | After move, rewrite href references in sibling TSX files. |
| `test/wrapElement.test.ts` | NEW — `wrapElement` tree-manipulation primitive (happy + unhappy paths, round-trip). |
| `test/linkSection.test.ts` | NEW — Link section's URL classification (internal / external / broken / custom) and per-tag default action selection. |
| `test/integration/pageRenameLinks.integration.test.ts` | NEW — page rename rewrites href in sibling pages. |
| `test/integration/previewWindowOpen.integration.test.ts` | NEW — external link from preview triggers `shell.openExternal`. |
| `src/shared/agentMd.ts` | Note the `/<page-slug>` href convention. |

Notably **not** touched: `generateCode.ts`, `parseCode.ts`,
`ScampElement` schema. The data layer already round-trips href via
the attribute bag, and the wrapping `<a>` is just an element with
children — no special generator/parser case.

---

## High-level flow

```
User opens Link section, picks "Dashboard" from page dropdown
    │
    ▼
LinkSection writes patch: { attributes: { href: '/dashboard' } }
    │
    ▼
canvasSlice updates element; syncBridge writes app/page.tsx
    │
    ▼
File on disk:
    <div data-scamp-id="rect_a1b2"
         className={styles.rect_a1b2}
         href="/dashboard">       ← if tag still <div> (invalid but round-trips)
                                    OR
    <a   data-scamp-id="rect_a1b2"
         className={styles.rect_a1b2}
         href="/dashboard">       ← after "Convert to <a>"

Canvas:
    Element renders normally; LinkIndicator overlays chain icon
    in top-right. User clicks icon → setActivePage('dashboard').

Preview:
    User clicks element in preview window's webview.
    Browser navigates webview to /dashboard (full reload, ~200ms).
    Toolbar URL bar updates via did-navigate handler.

External link:
    User picks External URL → 'https://example.com'.
    LinkSection writes attributes.href + target='_blank' + rel='noopener noreferrer'.
    In preview, click triggers window.open → setWindowOpenHandler →
    shell.openExternal opens the system browser.
```

---

## Open questions (please review)

**Q1. Per-tag default for Convert vs. Wrap**
Plan: both options are always offered (where they make sense), but
the default-recommended action depends on the current tag:
- **Convert default**: `<div>`, `<span>`, `<p>`, `<button>`.
- **Wrap default**: semantic block tags (`<article>`, `<section>`,
  `<header>`, `<nav>`, `<aside>`, `<main>`, `<footer>`, `<figure>`).
- **Wrap-only**: self-contained content (`<img>`, `<video>`,
  `<iframe>`, `<svg>`, `<input>`, `<textarea>`, `<select>`).

`<button>` lands in Convert because the canonical "button that
navigates" is `<a>` styled like a button (`<button>` inside `<a>`
is technically invalid HTML), but Wrap is still available as the
secondary option for users who want to preserve the literal
`<button>`. My pick: **the table above**. Confirming.

**Q2. `<a>` vs `<Link>` from next/link**
Plan: use plain `<a href="/dashboard">` for internal links. Cost:
full page reload on internal navigation in `next dev` (vs. instant
client-side routing with `<Link>`). Benefit: no import management
in generated TSX, simpler model. My pick: **plain `<a>`** for now;
upgrade to `<Link>` later if reload speed becomes a complaint.
Confirming.

**Q3. href stored in `attributes.href` vs. new typed field**
Plan: use the existing attribute bag — no new field on
`ScampElement`. The Link section parses href on every render to
decide UI (page dropdown / URL input / broken). Alternative: typed
`linkTo: { kind: 'page', slug: string } | { kind: 'url', value: string }`.
My pick: **attribute bag** — leaner, file-is-truth, no schema
migration. Confirming.

**Q4. Wrapping `<a>`'s default `display` value**
Plan: Scamp creates the wrapper with
`customProperties.display = 'block'` so a wrapped block-level child
still renders as a block (default `<a>` is inline, which would
collapse a `<div>` child onto a single line). Alternative:
`display: 'contents'` — the wrapper has no rendering box at all,
the child renders in its natural place. `contents` is more
invisible but has slightly patchy accessibility behaviour in older
browsers. My pick: **`display: block`** — predictable layout, no
surprises. The user can override to `contents` from the panel later
if they want the wrapper to vanish from layout flow. Confirming.

**Q5. Page rename href refactor — automatic or opt-in**
Plan: automatic on every page rename. The user renamed the page; if
we don't refactor refs, every internal link to that page silently
breaks. Alternative: prompt "X pages link to this page — update
references? [Y/N]". My pick: **automatic** — broken links are
strictly worse than refactored ones, and the refactor is reversible
(undo restores both the rename and the href changes via the pending-
writes path). Confirming.

**Q6. Broken-link UX — passive indicator or active fix prompt**
Plan: passive — red chain icon + tooltip "page not found." The user
fixes by re-picking from the dropdown. Alternative: a Project-wide
"broken links" report somewhere in Settings. My pick: **passive
indicator only** for the POC; project-wide report is a follow-up
when there are enough projects to need it. Confirming.

**Q7. Anchor links / hash fragments (`#section-id`)**
Plan: out of scope. The dropdown only knows about pages (file-
backed routes); anchor scrolling needs `id` attributes on elements
which Scamp doesn't model yet. Free-text URL input does accept
anything (including `#anchor`) and round-trips, but no intelligent
support. My pick: **defer to a follow-up** that adds element id
support + anchor link UI. Confirming.

---

## Out of scope

- **`<Link>` from `next/link`.** Follow-up; the `<a>` model already
  works in `next dev` and production.
- **Anchor / hash links** (`#section`). Needs element `id`
  attribute support first.
- **Programmatic navigation** (`router.push` from event handlers).
  Out of scope; Scamp doesn't model JS yet.
- **Form actions / `mailto:` / `tel:`.** External URL field accepts
  these as raw strings and they round-trip — no intelligent UI.
- **Auto-follow page switches in preview.** Already a separate
  backlog entry under Preview-mode follow-ups.
- **Project-wide broken-link report.** Per-element indicator only;
  project view is a follow-up.
- **Legacy-format projects.** They can't run preview anyway, and
  the route convention (`./<page>`) differs. Skipped — legacy
  users either migrate to nextjs or use the Element section's free-
  text href as today.

---

## Risks

- **Inert href is impossible by construction.** The Link section
  keeps the destination dropdowns disabled until the element is an
  `<a>` (Convert path) or has an `<a>` wrapper (Wrap path). So
  there's no path through the UI where href lands on a non-`<a>`
  element. Hand-edited or agent-written `href="/foo"` on a `<div>`
  still round-trips through `attributes.href`, but Scamp's UI won't
  produce that state.
- **Wrap creates an extra layer in the layers panel.** Users who
  habitually link a lot of cards may end up with a tree noticeably
  deeper than they expect. Mitigation: the wrapping `<a>` has a
  recognisable name in the layers panel ("Link to /dashboard"
  derived from its href), and Unlink → "Remove wrapper" is one
  click. Reconsider if it becomes a complaint.
- **Page rename regex false positives.** A string literal in TSX
  that happens to look like `href="/<old>"` would be rewritten
  even if it's not a link. Low likelihood (TSX doesn't usually
  contain raw href-shaped strings) but possible. Mitigation: anchor
  the regex tightly to attribute syntax (`\bhref\s*=\s*"/<old>"`),
  test with deliberate-false-positive fixtures.
- **Preview window-open handler timing.** The webview's
  `webContents` doesn't exist until the dom-ready event. If a user
  clicks a link before that fires (unlikely — page would still be
  loading), the handler isn't attached. Mitigation: attach inside
  the existing `did-finish-load` path so the handler is in place
  before any user interaction can happen.
- **External URL field accepts anything.** A user pasting
  `javascript:alert(1)` would land in the file as
  `<a href="javascript:alert(1)">`. Real risk because Scamp
  projects are local-trust but the preview window is just a webview.
  Mitigation: refuse `javascript:` and `data:` schemes in the URL
  input with an inline error; the attribute bag's lossless contract
  still preserves anything an agent / hand-edit puts there.
- **`shell.openExternal` opens user-controlled URLs.** Same
  surface — a user pasting a hostile URL into External URL and
  clicking it in preview opens it in their browser. Acceptable
  because the URL is the user's own input; not exploitable from
  outside Scamp.
