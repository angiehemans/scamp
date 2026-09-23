# Website import — Plan

Status: **for review.** Written 2026-09-23 against `main` at v0.8.0.

## Goal

**Import** opens a window, you paste a URL and navigate to the page you
want, and clicking **Import** turns what is on screen into a new view in
the open project — editable on the canvas, not a screenshot.

The measure of success is not fidelity. It is whether the result is
**worth editing**: a layer tree a person can read, styles the panel can
change, and an honest list of what didn't come across.

## The reframe: this is not a new parser

Scamp already has a complete "markup + CSS → element tree" pipeline —
`parseCode`. The importer should not be a second one.

```
  webview (the live page)
    │  capture script: DOM walk + style delta + asset manifest
    ▼
  CapturePayload            ← plain JSON, crosses IPC
    │  reducer (PURE, src/renderer/lib/)
    ▼
  ScampElement tree
    │  the existing path, unchanged
    ▼
  generateCode → files on disk → the view opens on the canvas
```

Only the middle box is new. The reducer is a pure function from a JSON
payload to an element tree, which means it lives in
`src/renderer/lib/`, is fully unit-testable per CLAUDE.md, and can be
developed against saved fixtures with no browser in the loop. That is
the whole de-risking strategy: **the hard part is testable offline.**

## What already exists

| Need | What it reuses | Gap |
|---|---|---|
| A window with a URL bar that loads a site | `src/main/previewWindow.ts` — a `BrowserWindow` with `webviewTag: true`, popup routing to the system browser, preload + `contextIsolation` | Needs an **Import** button and a second window kind; ~80% is there |
| CSS declaration → typed field | `lib/cssPropertyMap.ts` — `cssToScampProperty`, 56 typed properties | Already the exact direction needed |
| Declarations → a built element | `parseCode/apply.ts` — `makeBaseline` + `applyDeclarations` | Reusable as-is |
| Tag → `ElementType` | `parseCode/tsx.ts:318` (`img` → image, `TEXT_TAGS` → text, else rectangle) | Reusable as-is |
| What an element tree emits as HTML | `lib/generateHtml.ts` — the inverse mapping | Reference for what round-trips |
| Downloading an image into the project | `importImage` → `copyImage` — WebP conversion, dedup, `public/assets/` | Needs a URL source instead of a local path |
| Creating the destination | `pageOps.createPage`, `viewTemplate` | Reusable as-is |
| Telling the user what was lost | `lib/viewLint.ts` + the Next.js migration report | Same shape, new findings |

## The hard part, stated honestly

**Not** fetching the page. The reduction from an arbitrary DOM to
Scamp's constrained model. Four problems, in order of difficulty:

### 1. Computed styles are not authored styles

`getComputedStyle` resolves **every** property — 340+ per element. Dump
that into `customProperties` and every element carries 300 junk
declarations; the file is unreadable and the panel is useless.

You need the *delta*, which is two diffs, not one:

- **vs. the UA default for that tag.** Render a bare `<p>`, `<div>`,
  `<ul>` … off-screen **in the same document**, compute it, and diff.
  Doing it in-document rather than from a hardcoded table means the
  page's own reset CSS is accounted for automatically.
- **vs. the parent's computed value, for inherited properties.**
  `color` matching the parent is not an authored declaration.

This is the one piece where being wrong makes the whole feature
worthless, which is why it gets a fixture suite before anything else is
built.

### 2. A DOM is far deeper than a design

Real pages nest wrapper divs ten-plus levels for layout hooks and
utility classes. Imported 1:1 the layers panel is unusable.

A collapse pass: a container with **one** child, no background, border,
padding, shadow or non-default layout, contributes nothing and should
be merged into its child. Conservative by default — it is better to
leave a redundant wrapper than to break a layout.

### 3. Layout models that don't map

Flex maps cleanly. Grid maps to Scamp's grid fields. Beyond that:
floats, table layout, `position: sticky` inside scroll containers, and
transforms used for layout have no clean equivalent. These land in
`customProperties`, render correctly on the canvas, and are listed in
the report as not-panel-editable.

### 4. Things with no representation at all

Pseudo-elements (`::before` / `::after`) are the big one — extremely
common for icons, dividers and decorative shapes, and Scamp has no
model for them. Also: shadow DOM, `<canvas>`, JS-injected content that
appears after capture, and `<iframe>` contents.

Each is **detected and reported**, never silently dropped. A user who
knows the three icons didn't come across can add them; a user who
doesn't will think Scamp is broken.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| What gets captured | The **live DOM + computed styles** from the webview, not the HTML/CSS source | The user asked for "the html and css that is loaded" — the loaded page is the DOM after cascade, media queries and JS. Fetching source files would mean reimplementing the cascade, and would miss anything JS rendered. |
| Where the capture script runs | In the page, via `executeJavaScriptInIsolatedWorld` | Needs live `getComputedStyle`. The isolated world keeps the page's own globals from interfering and vice versa. |
| What crosses IPC | A serialized `CapturePayload`, size-capped | Keeps the reducer pure and the payload fixture-able. A cap because a large page can produce megabytes. |
| Where the reducer lives | `src/renderer/lib/importReduce.ts`, pure | CLAUDE.md requires full test coverage for `lib/`; a pure reducer is testable against saved payloads with no browser. |
| `customProperties` policy | An **allowlist** of visually-meaningful properties, unlike `parseCode`'s keep-everything | A hand-written file only contains what its author meant. A computed-style capture contains everything. The two need different rules. |
| What it creates | A **new view** (scamp) or page (nextjs/legacy), never an overwrite | An import is a starting point; destroying existing work would make it unusable for iteration. |
| Destination naming | Derived from the page `<title>`, deduped | Predictable, and avoids a modal before the user has seen the result. |
| Images | Downloaded into `public/assets/` through the existing `copyImage` | Gets WebP conversion, dedup and the assets convention for free. A remote URL that 404s later would silently rot the design. |
| Fonts | Detected, reported, and offered to Project Settings → Fonts | Scamp already manages `@import` lines there; an importer that writes them directly would fight that panel. |
| Tokens | Phase 3, not phase 1 | Extracting repeated colours and spacing into `theme.css` is what makes an import *editable* rather than a dead snapshot — but it is a separate problem from getting the tree right. |
| Breakpoints | Phase 4: re-capture at each project breakpoint width, diff, emit `@media` overrides | The model already supports it; doing it in v1 triples capture complexity before the basics are proven. |

## What real pages broke, and the fix

Phase 2 shipped working against one hand-written fixture page and fell
apart on the first two real sites (`scamp.club`, `resovaiq.com`): the
layout was, in Angie's words, "really bad on both". Three causes, in
order of how much damage they did.

**1. Scamp has no model for block flow, and the web's default IS block
flow.** Scamp emits `position: absolute; left: 0; top: 0` for a child
of a parent that is not a flex or grid container — in flex, a child is
in flow; outside one, it is pinned. Real pages are mostly plain block
containers, so importing them as-is pinned everything at the origin:
**303 of 541 rules** on one site, 72 of 257 on the other.

The fixture never showed it because I wrote the fixture, and I wrote it
flex-first the way I would build a page today. It had three block
containers with children. That is the fixture trap one level up: real
captures beat imagined ones, and *my* page is still an imagined one.

The fix is to translate rather than transcribe. A block container
stacking its children down the page IS `flex-direction: column` with
the default `align-items: stretch`; one whose children are all inline
is the row case. Absolute positioning fell to **4% on both sites**, and
what remains is genuinely sticky or absolute.

**2. `margin: 0 auto` computes to pixels.** The centring idiom — the
most common layout idiom on the web — arrives as `margin: 0px 120px`,
which pins the element to the width the capture happened at. Equal
non-zero side margins on an element that also caps its width is that
idiom with near-certainty, and is restored to `auto`.

**3. The root carried the viewport.** `document.body` reports the
window it was measured in, so every import arrived with `max-width:
1440px; min-height: 900px` on its root. The root's size is the
artboard's.

Two smaller ones: `min-width` / `min-height` compute to `0px` on a
block element and `auto` on a flex item, and only `auto` was treated as
"nothing set" — which put `min-height: 0px` on **296 of 541** rules.
And `text-align: start` and `list-style-type: disc` are initial values
that were being carried onto every root.

## Phases

Each is independently shippable and independently useful.

### Phase 1 — The reducer, against fixtures. No UI. **(landed)**

Save three real pages' `CapturePayload` as fixtures (a marketing page,
a docs page, an app shell). Build `importReduce.ts` and its test suite.
Ship nothing to users.

Deliverable: `payload → element tree` with tests covering the style
delta, the collapse pass, tag classification, text wrapping, and each
"cannot represent" detection.

Why first: it is the only part that can fail in a way that kills the
feature, and it is the only part testable without a browser.

**What it cost to be wrong, and how often.** Every correction below
came from running the thing against a real browser's output; none of
them was visible from reasoning about it.

- The plan said to diff each element against a bare probe of the same
  tag in the source document. That answers the wrong question. The one
  that matters is "what must a Scamp module declare to reproduce this",
  and a page with no reset gets the UA's `<p>` margin for free — diff
  it away and the import loses its paragraph spacing, because Scamp's
  own reset zeroes it. Capture now never consults the source baseline.
- A `flex: 1 1 0` card computes `width: 442.656px`. Declaring it
  freezes the card. Roughly a third of captured properties turned out
  to be layout *results* rather than decisions — `border-*-color` on
  every element with no border, `transform-origin` derived from every
  box, `box-sizing` from the page's reset. Filtering them took the
  payload from 18 properties per node to 10.5.
- Dropping a computed size is not the same as deleting the
  declaration: the model's baseline then supplies a hardcoded 100px
  box. The size mode has to be set to `auto` explicitly.
- `collapse` ate the view's own root, because a root with one child
  and no styling looks exactly like a redundant wrapper.

The reducer reuses `makeBaseline` + `applyDeclarations` rather than
reimplementing the declaration → typed-field mapping, so an imported
element and a hand-written one cannot disagree about what
`padding: 16px` means.

**Still open at the end of phase 1**, and better decided with the
window in hand than guessed now:

- **Authored vs. computed sizes.** The conservative rule is "a node
  with children is sized by its content". The precise answer needs the
  authored rules, readable through `document.styleSheets` for
  same-origin stylesheets and blocked for cross-origin ones. Worth
  doing in phase 2 with the heuristic as the fallback.
- **Internal links** still carry the source page's absolute URL.
  They should become project-relative when the target is also
  imported.
- **Colour format.** Captured colours are `rgb(…)`; the panel and
  theme tokens are hex. Converting belongs with phase 3's token
  extraction.
- **The root's own layout.** The captured `<body>` rarely declares
  one, so children of the root land as absolutely positioned. The
  window's capture should probably give the root a flex column.

### Phase 2 — The window and the round trip. **(landed)**

A second window kind alongside the preview: URL bar, back/forward, an
**Import** button. The capture script. Payload → reducer → `createPage`
→ the view opens on the canvas.

Deliverable: paste a URL, navigate, click Import, get an editable view.

**What it is.** A third `BrowserWindow` beside the app and the preview
(`main/importWindow.ts`, `preload/import.ts`,
`renderer/import/ImportApp.tsx`), reached from **↧ Import a page…**
under the Pages sidebar. The capture runs in the import window's
renderer, because `executeJavaScript` on the `<webview>` tag is what
reaches the live document; the payload goes through main to the app
window, which owns the project, the reducer and the generator. The
import window never sees a file — it hosts a third-party page, so it
has the smallest preload in the app.

An import creates a **view**, through `createComponent({ kind: 'view' })`
— one call that writes the files and the route together, so there is no
window in which a half-made view exists on disk. The name comes from
the page title and is deduped, so a second import of the same page
lands beside the first rather than on top of it.

**Two things went wrong, and both were the same shape as bugs this
month's release fixed:**

- `createPage` is the *legacy* path. In a framework project it answers
  "A Scamp-format project has no pages; add a view instead." Written
  from the mental model of pages rather than views — the same mistake
  that made Replace image dead on every framework page.
- The `<webview>` tag's methods, `executeJavaScript` among them, only
  exist once it has emitted `dom-ready`. Before that the element is in
  the DOM and the call is not, which presents as a button that does
  nothing at all. Import is now gated on `dom-ready`, and the guard
  reports rather than returning silently.

Neither was findable by reading. Both took an e2e test that drives the
real windows.

**Verified** by `test/e2e/import/import-window.spec.ts` against all
three project formats: the button opens the browser, the browser reads
the local fixture page, a view appears on disk with the page's semantic
tags and its three images, the styles are in the module rather than
inline, and the report names the decorative `::before` it could not
bring across. A second import of the same page creates `…2`.

### Phase 3 — Assets and tokens.

Images downloaded through `copyImage`. Repeated colours and spacing
lifted into `design/theme.css` as tokens, with module CSS referencing
them. Fonts detected and offered.

Deliverable: an import whose colours change from the theme panel.

### Phase 4 — Fidelity and the report.

Re-capture at each breakpoint width and emit the overrides. The import
report: what was collapsed, what landed in `customProperties`, which
pseudo-elements were dropped, which assets failed.

Deliverable: an import you can trust, because it tells you where it
lied.

## What this will not do

Stated so the feature is judged against the right bar:

- **Pixel-perfect reproduction.** The output is a starting point.
- **Interactive behaviour.** No JS, no state, no event handlers.
  Hover styles come across; a dropdown's open state does not.
- **Whole sites.** One page per import.
- **Authentication-walled pages** beyond whatever the window's session
  happens to hold.
- **Legal clearance.** Importing a page you don't own is the user's
  call, the same as it is in a browser's devtools or a Figma plugin.
  Worth one line in the docs; not a gate in the product.

## Risks

| Risk | Mitigation |
|---|---|
| The reduction produces an unusable tree and the feature is abandoned late | Phase 1 proves it against real fixtures before any UI exists |
| Payload size on a large page | Cap it, and report the cap rather than truncating silently |
| Capture script breaks on a hostile or unusual page | It runs isolated, wrapped, and a failure reports rather than throws |
| Import becomes a silent-failure machine, like the five `activePage` bugs this release fixed | Every unrepresentable thing is a report entry. That is a phase-4 deliverable but the detection is built in phase 1. |
| Scope creep toward "a browser" | The window does URL, navigate, import. No tabs, no bookmarks, no devtools. |

## Open questions for review

1. **Is a view the right destination**, or should an import land
   somewhere staged — a scratch view the user promotes — so a bad
   import doesn't clutter Pages?
   no just create a view, users can always delete it if they dont like it.
2. **How aggressive should the collapse pass be?** Conservative leaves
   wrapper noise; aggressive risks breaking layouts. I lean
   conservative and would rather tune it against fixtures than guess. - conservative
3. **Is partial import worth it in v1** — the user picks an element in
   the window and imports only that subtree? It is a much better fit
   for "I want this hero section" and avoids the whole-page depth
   problem, but it needs element-picking UI in the window. this can be a feature for later
4. **Should phase 1 ship behind a flag** so real payloads can be
   gathered from real use before the UI is finalised? no

## Done when

- [ ] A designer pastes a URL, navigates, clicks **Import**, and a new
      view opens on the canvas with a layer tree they can read.
- [ ] Colours and spacing come from `theme.css` tokens, so changing the
      theme changes the import.
- [ ] The import report names everything that didn't come across.
- [ ] `importReduce.ts` has full coverage per CLAUDE.md, including the
      unhappy paths: empty page, single element, 5000 elements, a page
      that is one `<canvas>`.
