# Scamp — Feature Backlog v2

User stories ordered easiest to hardest.

---

## 1. Visibility and opacity controls

**User story**

As a user designing a layout, I want to toggle an element's visibility or adjust
its opacity from the WYSIWYG properties panel so I can hide elements or make them
translucent without having to write CSS manually.

**Behaviour**

- A new "Visibility" section appears in the WYSIWYG panel below the appearance
  controls for every selected element
- **Opacity** — a number input (0–100) and a range slider, both in sync. Value
  maps to the CSS `opacity` property (0–1). Default is 100 (fully opaque)
- **Visibility** — a segmented control with three options:
  - Visible (default — no property emitted)
  - Hidden (`visibility: hidden` — element takes up space but is not visible)
  - None (`display: none` — element removed from layout entirely)
- Both properties round-trip through `parseCode` and appear in the raw CSS
  editor as normal
- When an element has `display: none` set, it is shown on the canvas with a
  faded checkerboard overlay so the user can still see and select it

**Notes**

- `display: none` conflicts with the flex display toggle in the layout section —
  if a user sets display to none via the visibility control, the flex toggle
  should show as disabled with a tooltip explaining why
- Opacity of 100 should not emit `opacity: 1` to the CSS file — that is the
  default and should be omitted to keep output clean

---

## 2. Typography tokens in the theme file

**User story**

As a user managing a project's design system, I want to define typography tokens
in my project's `theme.css` file alongside color tokens so I can use consistent
font sizes, weights, and line heights across my design using CSS variables instead
of hardcoded values.

**Behaviour**

- The theme panel gains a "Typography" section alongside the existing "Colors"
  section
- Typography tokens are stored in `theme.css` as CSS custom properties, the
  same as color tokens:
  ```css
  :root {
    /* Colors */
    --blue-500: #0000ff;

    /* Typography */
    --text-xs:    0.75rem;
    --text-sm:    0.875rem;
    --text-base:  1rem;
    --text-lg:    1.125rem;
    --text-xl:    1.25rem;
    --font-sans:  'Inter', sans-serif;
    --font-mono:  'JetBrains Mono', monospace;
    --leading-tight:  1.25;
    --leading-normal: 1.5;
    --leading-loose:  1.75;
  }
  ```
- The theme panel lets users add, rename, and delete typography tokens — same
  interaction pattern as color tokens
- Token type is inferred from the value: `rem`/`px`/`em` values are size tokens,
  quoted strings are font-family tokens, unitless numbers are line-height tokens
- In the WYSIWYG panel, typography inputs (font-size, line-height, font-family)
  show a token picker alongside the raw input — selecting a token inserts
  `var(--text-lg)` as the value
- Typography tokens are available as autocomplete suggestions in the raw CSS
  editor, the same as color tokens
- `theme.css` changes are watched by chokidar and hot-reload into the token
  picker immediately

**Notes**

- Spacing tokens (`--spacing-md: 16px`) are a natural next step but are out of
  scope for this story — keep the theme panel focused on typography and color
  for now
- Font-family tokens that reference external fonts (Google Fonts etc.) are the
  user's responsibility to load — Scamp doesn't manage font loading, just the
  variable definition

---

## 3. Save status indicator

**User story**

As a user working on a layout, I want to see a clear indicator in the app that
tells me whether my changes have been saved to disk so I never lose progress
because a file write hadn't finished when I expected it had.

**Behaviour**

The indicator lives in the toolbar area, right-aligned near the project name. It
has four states:

| State | Display | When |
|---|---|---|
| Saved | `✓ Saved` — subtle, green or muted | Canvas state, Zustand state, and file contents are all in sync |
| Saving | `↑ Saving…` — neutral, animated | A debounce is in progress or a file write is in flight |
| Unsaved changes | `● Unsaved` — amber | Canvas state has changed but the debounce hasn't fired yet |
| Error | `⚠ Save failed` — red | A file write returned an error |

**Sync logic**

The indicator watches three sources and only shows "Saved" when all three agree:

1. **Zustand canvas state** — has anything changed since the last write?
2. **File write IPC** — is a write currently in flight?
3. **chokidar confirmation** — has the file changed event come back confirming
   the write landed on disk?

The flow for a canvas change:

```
User makes a change
  → indicator: "Unsaved changes"
  → debounce starts (200ms)
  → debounce fires, file write begins
  → indicator: "Saving…"
  → file write completes, IPC confirms
  → chokidar fires confirming file on disk matches state
  → indicator: "Saved"
```

**Error handling**

- If a file write fails, the indicator shows "Save failed" with a retry button
- Clicking retry re-attempts the last write
- The error state persists until a successful write — it does not auto-dismiss
- A failed write should also be logged to the terminal panel if it is open

**Notes**

- The "Saved" state should have a short fade-in after confirmation so it doesn't
  flash on every keystroke — wait for the chokidar confirmation, then animate in
- The indicator should be visible at all times when a project is open, not just
  when something is happening — a persistent "Saved" state is reassuring
- Panel edits via the CSS editor follow the same flow as canvas changes — the
  `file:patch` IPC call triggers the same saving/saved transition

---

## 4. HTML element types

**User story**

As a user building a layout, I want to change the HTML tag of any rectangle or
text element to a semantically appropriate tag so my exported code is meaningful
and accessible, not just a wall of divs and paragraphs.

As a user building a form or interactive UI, I want to place input elements on
the canvas so I can design real forms without having to hand-code them after
the fact.

As a user placing media on the canvas, I want to use video and iframe elements
in addition to img so I can design layouts that include embedded content.

**Behaviour — changing element tags**

- Every element in the properties panel has an "Element" section at the top
  showing the current tag in a dropdown
- Changing the tag updates the TSX output immediately — the element's class name
  and `data-scamp-id` are preserved, only the tag changes
- The canvas renders the correct HTML element — a `button` looks like a button,
  a `nav` looks like a div (no default browser styling bleeds into the canvas)
- The WYSIWYG panel adapts to the selected tag — extra property fields appear
  for tags that require them (see per-tag notes below)

**Rectangle tags (div variants)**

All of these behave identically to a `div` on the canvas. Same flex controls,
same sizing, same appearance properties. The tag change is purely semantic.

| Tag | Notes |
|---|---|
| `div` | Default |
| `section` | |
| `article` | |
| `aside` | |
| `main` | |
| `header` | |
| `footer` | |
| `nav` | |
| `figure` | |
| `form` | Adds `method` (GET / POST) and `action` fields in the Element section |
| `fieldset` | |
| `ul` | Drawing a child rectangle inside a `ul` defaults the child tag to `li` |
| `ol` | Same as `ul` |
| `li` | |
| `details` | |
| `summary` | |
| `dialog` | Adds an `open` toggle in the Element section |
| `button` | Adds a `type` field (button / submit / reset) in the Element section |
| `a` | Adds `href` and `target` (\_self / \_blank) fields in the Element section |

**Text tags (p variants)**

| Tag | Notes |
|---|---|
| `p` | Default |
| `h1` – `h6` | Shown as a single "Heading level" dropdown |
| `span` | |
| `label` | Adds a `for` text input in the Element section |
| `blockquote` | Adds a `cite` text input in the Element section |
| `pre` | |
| `code` | |
| `strong` | |
| `em` | |
| `small` | |
| `time` | Adds a `datetime` text input in the Element section |
| `figcaption` | |
| `legend` | |
| `li` | Text variant when the element has no children |

**Media tags (img variants)**

| Tag | Notes |
|---|---|
| `img` | Default — existing behaviour |
| `video` | Adds `src`, `controls`, `autoplay`, `loop`, `muted` fields. Renders as a placeholder rectangle with a play icon on the canvas |
| `iframe` | Adds `src` and `title` fields. Renders as a placeholder — does not load the iframe content in the canvas viewport |
| `svg` | Renders as a placeholder rectangle. Element section shows a raw SVG source textarea passed through verbatim to the TSX output |

**Input elements (new element type)**

Input elements need their own toolbar button (`⊞` keyboard: `F`) and render
with a default appearance that hints at their type.

| Tag | Notes |
|---|---|
| `input` | `type` dropdown: text, email, password, number, checkbox, radio, range, date, file. Canvas preview updates to reflect the type |
| `textarea` | Adds `rows` and `placeholder` fields |
| `select` | Children are `option` elements managed as a list in the Element section — not as nested canvas elements |
| `option` | Not independently placeable — only managed through the select Options editor |

**Element section in the WYSIWYG panel**

A new collapsible "Element" section at the top of the properties panel contains:

- Tag dropdown (full list for the element type)
- Tag-specific attribute fields for the current tag
- Fields appear and disappear as the tag changes — no stale fields left visible

**Code output**

```tsx
<nav data-scamp-id="a1b2" className={styles.rect_a1b2}>
  <a
    data-scamp-id="c3d4"
    className={styles.rect_c3d4}
    href="/about"
    target="_self"
  >
    <span data-scamp-id="e5f6" className={styles.text_e5f6}>About</span>
  </a>
</nav>
```

**Notes**

- Class name prefixes stay as `rect_`, `text_`, and `img_` regardless of the
  specific tag — a `nav` is still `rect_a1b2`, an `h1` is still `text_c3d4`
- `parseCode` must be updated to recognise all supported tags
- Tag-specific attributes must round-trip through the parser — unknown attributes
  preserved verbatim, never discarded
- `agent.md` should document the full list of supported tags

---

## 5. Canvas size rework

**User story**

As a user building a layout, I want the canvas to represent a viewport I can
resize freely so my page can grow with its content, and I want the root element
to use natural sizing rather than fixed pixel dimensions so the generated CSS is
actually usable outside of Scamp.

**The problem with the current approach**

Currently the canvas size (1440×900) is written directly into the root element's
CSS as `width: 1440px; height: 900px`. This means the generated code has a
hardcoded fixed size on the outermost element, which is not how real web pages
work. The canvas size is a design tool concept — it should not bleed into the
output CSS.

**Root element sizing**

- The root element's width and height default to `width: 100%; height: auto`
- The user can change these via the WYSIWYG panel like any other element — they
  just default to sensible values instead of fixed pixels
- The root element no longer has any special-cased sizing logic — it is treated
  the same as any other rectangle

**Canvas size (viewport frame)**

- The canvas viewport frame (the white rectangle the design sits inside) has its
  own size setting, separate from the root element's CSS
- Default canvas size: 1440px wide
- Height is not fixed — the canvas grows with the content inside it, the same
  way a real browser page does
- An **overflow hidden toggle** in the canvas settings clips content that extends
  outside the viewport width — useful for seeing how a layout behaves at a
  specific width without content spilling
- Canvas size is saved in the app's project metadata (alongside the recent
  projects list in `app.getPath('userData')`) — it is never written to the CSS
  file
- A canvas size control is accessible from the toolbar or a canvas settings
  popover — the user can type a custom width (e.g. 1280, 1440, 1920) or choose
  from presets:

| Preset | Width |
|---|---|
| Mobile | 390px |
| Tablet | 768px |
| Desktop (default) | 1440px |
| Wide | 1920px |
| Custom | User-defined |

**Notes**

- This is a breaking change for existing projects — the root element's CSS will
  need to be migrated from fixed pixel dimensions to `width: 100%; height: auto`
  on first open after this update ships. Show a one-time migration notice to
  the user
- The canvas height growing with content means the scrollable area of the canvas
  panel grows too — the canvas panel must handle vertical scrolling correctly
- The overflow hidden toggle maps to `overflow: hidden` on the canvas viewport
  frame only — it does not affect the root element's CSS

---

## 6. Mobile and tablet breakpoint toggles

**User story**

As a user designing a responsive layout, I want to switch the canvas to a mobile
or tablet viewport and make style edits that are automatically applied inside the
correct media query, so I can design for multiple screen sizes in Scamp without
writing media queries by hand.

**Dependencies**

This feature requires the canvas size rework (story 5) to be complete first.
The breakpoint system builds directly on top of the canvas preset sizes.

**Behaviour**

- The toolbar gains a viewport toggle with three modes:

  ```
  [ Desktop ]  [ Tablet ]  [ Mobile ]
  ```

- Switching modes resizes the canvas viewport to the preset width for that
  breakpoint (390px mobile, 768px tablet, 1440px desktop)
- In Desktop mode, style edits apply to the base CSS as they do today
- In Tablet or Mobile mode, style edits apply inside a media query block in the
  CSS module:
  ```css
  .rect_a1b2 {
    width: 100%;
    padding: 24px;
  }

  @media (max-width: 768px) {
    .rect_a1b2 {
      padding: 12px;
    }
  }

  @media (max-width: 390px) {
    .rect_a1b2 {
      padding: 8px;
    }
  }
  ```
- The canvas renders the element with the correct resolved styles for the active
  breakpoint — desktop styles as the base, tablet/mobile overrides applied on
  top
- The WYSIWYG panel shows the current value for the active breakpoint — if a
  property has a breakpoint-specific override, it shows that value with a small
  indicator (e.g. a coloured dot on the field label) to signal it differs from
  the desktop base
- The raw CSS editor also scopes to the active breakpoint — it shows only the
  declarations for that breakpoint's media query block, not the full class

**Breakpoint configuration**

- Default breakpoints: Desktop 1440px, Tablet 768px, Mobile 390px
- Breakpoints are configurable per-project in a project settings panel — the
  user can change the pixel values or add a custom breakpoint
- Breakpoint values are saved in project metadata alongside canvas size — not
  written to the CSS file

**Code output**

Media queries are appended at the bottom of the CSS module, grouped by
breakpoint. All breakpoint overrides for all classes at a given breakpoint are
in one `@media` block:

```css
/* Base styles */
.rect_a1b2 { ... }
.rect_c3d4 { ... }

/* Tablet */
@media (max-width: 768px) {
  .rect_a1b2 { padding: 12px; }
  .rect_c3d4 { width: 100%; }
}

/* Mobile */
@media (max-width: 390px) {
  .rect_a1b2 { padding: 8px; }
}
```

**`parseCode` updates**

The parser must be updated to:
- Read and parse `@media` blocks in the CSS module
- Map media query declarations back to the correct element and breakpoint in
  Zustand state
- Preserve any media query blocks it doesn't recognise (custom breakpoints
  added by an agent or the user manually) verbatim in `customProperties`

**Notes**

- Breakpoint edits via an agent or external editor should round-trip correctly —
  if an agent adds a `@media (max-width: 768px)` block, the canvas should
  reflect it when the user switches to tablet mode
- Desktop mode should always be the base — never nest desktop styles inside a
  media query. Mobile-first (`min-width`) vs desktop-first (`max-width`) is a
  deliberate choice here; `max-width` is simpler to reason about in a visual
  tool where the user starts at desktop size
- This is the most complex feature in this backlog — `parseCode`,
  `generateCode`, and the entire WYSIWYG panel all need to be breakpoint-aware.
  Build and test story 5 fully before starting this one
  