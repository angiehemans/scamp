# Scamp — Panel Capabilities

**Date:** 2026-05-13

A snapshot of what the visual (WYSIWYG) properties panel can edit
directly. Anything not listed here either:

- Lives in the **raw CSS panel** (any valid CSS works there, but the
  visual panel doesn't surface a typed control for it), OR
- Lands in `customProperties` and round-trips verbatim through the
  file without a panel control.

---

## CSS properties editable from the panel

Organized by the section that owns them.

### Position section
- `position` — `static`, `relative`, `absolute`, `fixed`, `sticky`, `auto` (Scamp default)
- `left` (via element `x`)
- `top` (via element `y`)

### Size section
- `width` — `px`, `%` (stretch), `auto`, `fit-content`, or any CSS length string (`vh`, `em`, `calc()`, `var()`)
- `height` — same units as width
- `min-height` — free-form CSS length string

### Layout section
- `display` — `none` (Scamp default = absolute layout), `flex`, `grid`
- **Flex container**: `flex-direction` (`row`, `column`), `gap`, `align-items`, `justify-content`
- **Grid container**: `grid-template-columns`, `grid-template-rows`, `column-gap`, `row-gap`, `justify-items`
- **Grid child** (when parent is a grid): `grid-column`, `grid-row`, `align-self`, `justify-self`

### Spacing section
- `padding` (4-side)
- `margin` (4-side)

### Background section
- `background-color`
- `background-image` (file picker — copies file into project assets)
- `background-size`
- `background-position`
- `background-repeat`
- `background-blend-mode` (visible only when both color and image are set)

### Border section
- `border-color`
- `border-style` — `none`, `solid`, `dashed`, `dotted`
- `border-width` (4-side)
- `border-radius` (4-corner)

### Shadows section
- `box-shadow` — multiple shadows supported; each row has x/y offset, blur, spread, color, opacity, and inset toggle

### Filters section
- `filter` — multiple filter functions: `blur`, `brightness`, `contrast`, `grayscale`, `hue-rotate`, `invert`, `opacity`, `saturate`, `sepia`
- `backdrop-filter` — same kinds as `filter`, gated behind an "Enable" toggle in the section

### Typography section (text elements only)
- `font-family`
- `font-size`
- `font-weight` — `400`, `500`, `600`, `700`
- `color`
- `text-align` — `left`, `center`, `right`
- `line-height`
- `letter-spacing`

### Visibility section
- `opacity`
- `visibility` — `visible`, `hidden`, or `display: none` (the "none" mode in the panel)
- `mix-blend-mode` — full set of CSS blend keywords (multiply, screen, overlay, hue, etc.)

### Transitions section
- `transition` — multiple transitions, each with property, duration, easing, and delay

### Animation section
- `animation` — single animation shorthand: keyframe name, duration, easing, delay, iteration count, direction, fill mode, play state. Recognised preset keyframe names: `fade-in`, `fade-in-up`, `fade-in-down`, `fade-in-left`, `fade-in-right`, `slide-up`, `slide-down`, `shake`, `pulse`, `spin`, `bounce`

---

## Element-attribute editors (not strictly CSS)

These live in the **Element section** and edit HTML attributes
rather than CSS, but they're driven by the same panel.

### Image section
- `src` (image file)
- `alt`

### Link controls (any element)
- Convert to `<a>` or wrap in `<a>` (LinkField)
- `href` — internal page reference or external URL
- `target` (Open in new tab toggle, sets `target="_blank"` + `rel="noopener noreferrer"`)

### Per-tag attributes (Element section)

| Tag         | Attributes                                                  |
| ----------- | ----------------------------------------------------------- |
| `button`    | `type` (`button`, `submit`, `reset`)                        |
| `form`      | `method` (`GET`, `POST`), `action`                          |
| `dialog`    | `open` (boolean)                                            |
| `label`     | `htmlFor`                                                   |
| `blockquote`| `cite`                                                      |
| `time`      | `datetime`                                                  |
| `video`     | `src`, `controls`, `autoplay`, `loop`, `muted`              |
| `iframe`    | `src`, `title`                                              |
| `input`     | `type` (text, email, password, number, checkbox, radio, range, date, file), `placeholder` |
| `textarea`  | `rows`, `placeholder`                                       |
| `select`    | Dedicated option-list editor (not the generic attribute UI) |
| `svg`       | Dedicated raw-source editor                                 |

---

## HTML tags Scamp models

Tag is selectable per element from the Element section's dropdown.
Each element type defaults to a specific tag and exposes a set of
options.

### Rectangle elements (default: `<div>`)
`div`, `section`, `article`, `aside`, `main`, `header`, `footer`,
`nav`, `figure`, `form`, `fieldset`, `ul`, `ol`, `li`, `details`,
`summary`, `dialog`, `button`, `a`

### Text elements (default: `<p>`)
`p`, `h1`, `h2`, `h3`, `h4`, `h5`, `h6`, `span`, `label`,
`blockquote`, `pre`, `code`, `strong`, `em`, `small`, `time`,
`figcaption`, `legend`, `li`, `a`

### Image elements (default: `<img>`)
`img`, `video`, `iframe`, `svg`

### Input elements (default: `<input>`)
`input`, `textarea`, `select`

---

## Color picker affordances

When any color control opens (background, border, text color,
shadow color, etc.) the picker exposes:

- **Saturation gradient** and **hue slider** — drag for live preview
- **Alpha slider** + numeric opacity input (linked) — except in
  Shadows, which manages alpha externally
- **Hex input** with `#fff` → `#ffffff` shorthand expansion on blur
- **Eyedropper** (macOS + Windows only — Linux is hidden until
  upstream `xdg-desktop-portal` / Mutter input-grab issues are
  resolved)
- **Project swatches** — combined row of theme color tokens and
  every other color used elsewhere in the project, deduplicated
- **Tokens tab** — separate tab listing every color-typed theme
  token defined in `theme.css`; clicking applies as `var(--name)`

---

## What's NOT in the visual panel

Reachable only via the raw CSS panel or by direct file edit
(round-trips verbatim through `customProperties`):

- `transform`, `clip-path`, `mask`, `mix-blend-mode` on specific
  pseudo-elements
- `cursor`, `pointer-events`, `user-select`
- `overflow`, `scroll-behavior`, `scroll-snap-*`
- `z-index`
- CSS Grid: `grid-area`, `grid-template-areas`, named line refs
  beyond the basic `grid-column` / `grid-row` shorthand
- `aspect-ratio`
- `isolation` (relevant to blend modes but no panel control)
- `outline`, `outline-offset`
- All `:focus-visible`, `:disabled`, `:checked`, `:nth-child(...)`
  pseudo-class rules — preserved verbatim, not modelled
- Multi-layer backgrounds beyond a single image
- `drop-shadow()` filter function (the other nine filter functions
  are typed)
- Any property the user / agent writes that isn't in the
  cssPropertyMap — preserved unchanged via `customProperties`

Per-state overrides (`:hover`, `:active`, `:focus`) are supported
for most of the above CSS properties via the state switcher in
the panel header; switch states, edit any property, and the
override commits to `stateOverrides[<state>]` on the element.
