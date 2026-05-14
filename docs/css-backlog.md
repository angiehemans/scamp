# Scamp — Feature Backlog v6
## Missing WYSIWYG Panel Controls

User stories ordered easiest to hardest. Each story promotes one or more
CSS properties from `customProperties` passthrough to a first-class visual
control in the WYSIWYG panel.

---

## 1. Interaction controls (cursor, pointer-events, user-select)

**User story**

As a user designing interactive elements, I want to control how the cursor
appears, whether an element responds to pointer events, and whether its
text can be selected, directly from the WYSIWYG panel so I can design
interactive behaviour without writing CSS manually.

**Behaviour**

A new "Interaction" section appears in the WYSIWYG panel for every
selected element, below the Visibility section.

| Control | Type | Options | Default |
|---|---|---|---|
| Cursor | Dropdown | auto, default, pointer, text, move, not-allowed, grab, grabbing, crosshair, zoom-in, zoom-out, none | auto |
| Pointer events | Segmented | Auto / None | Auto |
| User select | Segmented | Auto / None / Text / All | Auto |

- Only non-default values are emitted to the CSS
- All three properties round-trip through `parseCode`
- `pointer-events: none` is particularly useful for overlay elements —
  worth a tooltip in the panel explaining what it does

---

## 2. Z-index, aspect-ratio, and isolation

**User story**

As a user managing element stacking, proportions, and blend mode
contexts, I want controls for z-index, aspect-ratio, and isolation
in the WYSIWYG panel so I can manage these properties visually without
dropping into the raw CSS editor.

**Behaviour**

**Z-index** — added to the Position section:
- Number input, accepts positive and negative integers and `auto`
- Default is `auto` — not emitted unless changed
- A small warning label appears when z-index is set on an element
  whose parent has `position: static` since z-index has no effect
  in that context

**Aspect ratio** — added to the Size section:
- A text input accepting any valid `aspect-ratio` value:
  `16 / 9`, `1`, `4 / 3`, `auto`
- Four common presets shown as pills below the input:
  `1/1`, `16/9`, `4/3`, `3/2`
- Clicking a preset populates the input
- Default is blank (not emitted)

**Isolation** — added to the Visibility section, below blend mode:
- A single toggle: Isolate on / off
- Maps to `isolation: isolate` when on, not emitted when off
- A tooltip explains the relationship to blend modes:
  "Creates a new stacking context. Use this to prevent blend modes
  from affecting elements outside this container."
- Only shown when `mix-blend-mode` is set on a child element or
  when the user explicitly enables it

---

## 3. Outline controls

**User story**

As a user designing accessible focus states and element highlighting,
I want to control outline properties from the WYSIWYG panel so I can
design focus rings and non-layout borders without writing CSS manually.

**Note:** Outline is distinct from border — it does not affect layout,
does not take up space, and draws outside the element's box model.
Worth explaining this distinction in a tooltip in the panel.

**Behaviour**

A new "Outline" section appears in the WYSIWYG panel, below the Border
section.

| Control | Type | Default |
|---|---|---|
| Outline width | Number input (px) | 0 |
| Outline style | Dropdown: none, solid, dashed, dotted, double | none |
| Outline color | Color picker + hex input | currentColor |
| Outline offset | Number input (px, accepts negative values) | 0 |

- The section is collapsed by default and expands when any outline
  property has a non-default value
- `outline-offset` accepts negative values — the outline draws inside
  the element boundary when negative
- All four properties round-trip through `parseCode`
- `outline: none` and `outline: 0` are both common — the parser should
  handle both and map them to the default (not emitted) state
- Outline is most commonly used in `:focus` and `:focus-visible` state
  overrides — the panel should surface it prominently in those states

---

## 4. Overflow and scroll controls

**User story**

As a user designing scrollable containers, modal overlays, and clipped
layouts, I want to control overflow and scroll behaviour from the WYSIWYG
panel so I can manage how content behaves at element boundaries without
writing CSS manually.

**Behaviour**

An "Overflow" section appears in the WYSIWYG panel, below the Size
section.

| Control | Type | Options | Default |
|---|---|---|---|
| Overflow X | Segmented | Visible / Hidden / Scroll / Auto | Visible |
| Overflow Y | Segmented | Visible / Hidden / Scroll / Auto | Visible |
| Scroll behavior | Segmented | Auto / Smooth | Auto |

- When both X and Y are set to the same value, a single `overflow`
  shorthand is emitted. When they differ, `overflow-x` and
  `overflow-y` are emitted separately
- `scroll-behavior` is only shown when overflow X or Y is set to
  `scroll` or `auto` — hidden otherwise
- A "Link axes" toggle keeps X and Y in sync so changing one changes
  both simultaneously

**Scroll snap controls**

When overflow X or Y is set to `scroll` or `auto`, a "Scroll snap"
sub-section expands:

| Control | Type | Options |
|---|---|---|
| Snap type | Segmented | None / X / Y / Both |
| Snap strictness | Segmented | Mandatory / Proximity |
| Snap align (on children) | Segmented | None / Start / Center / End |
| Snap stop | Segmented | Normal / Always |

- `scroll-snap-type` maps to the snap type + strictness combination:
  `scroll-snap-type: x mandatory`
- `scroll-snap-align` and `scroll-snap-stop` apply to the element's
  children — shown only when snap type is set, with a note:
  "These properties apply to child elements inside this container"
- All scroll snap properties round-trip through `parseCode`

---

## 5. Drop-shadow filter function

**User story**

As a user applying filter effects, I want to use the `drop-shadow()`
filter function from the Filters section so I can apply shadows that
follow the shape of non-rectangular elements (like transparent PNGs
and SVGs) rather than the element's bounding box.

**Note:** `drop-shadow()` is a CSS filter function and is distinct from
`box-shadow` — it respects transparency and follows the visible shape
of the content. Worth a tooltip explaining the difference.

**Behaviour**

- `drop-shadow` is added to the filter type dropdown in the Filters
  section alongside the existing nine filter functions
- Each drop-shadow row has:

  | Control | Type | Default |
  |---|---|---|
  | X offset | Number input (px) | 0 |
  | Y offset | Number input (px) | 4px |
  | Blur | Number input (px) | 8px |
  | Color | Color picker + hex + opacity | rgba(0,0,0,0.25) |

- Note: `drop-shadow()` does not have a spread parameter unlike
  `box-shadow` — the spread input is hidden for this filter type
- Multiple `drop-shadow()` functions can be added as separate rows
- Output in the `filter` value:
  ```css
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.25));
  ```
- The parser decomposes `drop-shadow()` back into its individual
  values the same way other filter functions are parsed

---

## 6. Transform controls

**User story**

As a user designing animated interfaces and visual effects, I want to
apply CSS transform functions to any element from the WYSIWYG panel so
I can translate, rotate, scale, and skew elements visually without
writing transform syntax manually.

**Behaviour**

A "Transform" section appears in the WYSIWYG panel, below the Filters
section.

A "+ Add transform" button appends a new transform row — multiple
transforms are applied in order and can be reordered via drag-and-drop
(same pattern as Filters).

Each transform row has a type dropdown and value inputs:

| Transform | Controls | CSS output |
|---|---|---|
| Translate | X (px / %) + Y (px / %) | `translateX(20px) translateY(10px)` |
| Translate X | Number input (px / %) | `translateX(20px)` |
| Translate Y | Number input (px / %) | `translateY(10px)` |
| Rotate | Number input (deg) | `rotate(45deg)` |
| Rotate X | Number input (deg) | `rotateX(45deg)` |
| Rotate Y | Number input (deg) | `rotateY(45deg)` |
| Scale | Single number (uniform) or X + Y | `scale(1.5)` or `scaleX(1.2) scaleY(0.8)` |
| Skew X | Number input (deg) | `skewX(10deg)` |
| Skew Y | Number input (deg) | `skewY(10deg)` |

**Transform origin**

When any transform is set a "Transform origin" control appears below
the rows:

- A 9-point grid picker for common origins (top-left, center, bottom-right etc.)
- A free-form text input for custom values (`50% 50%`, `0 0`, `bottom right`)
- Maps to the `transform-origin` property
- Default is `50% 50%` — not emitted unless changed

**Code output**

All transform functions are combined into a single `transform` property:

```css
transform: translateX(20px) rotate(45deg) scale(1.2);
transform-origin: top left;
```

**`parseCode` updates**

- `transform` and `transform-origin` added to the property map
- The `transform` value must be decomposed back into individual
  function rows — each function parsed into its type and values
- Unrecognised transform functions preserved in `customProperties`

---

## 7. Additional pseudo-class states

**User story**

As a user designing form elements and accessible interfaces, I want to
define styles for `:focus-visible`, `:disabled`, `:checked`, and
`:placeholder` states on any element from the state switcher in the
properties panel, so I can design these interactive states visually
without writing pseudo-class CSS manually.

**Context**

The state switcher currently supports `:hover`, `:active`, and `:focus`.
This story adds four more states that are particularly relevant to form
and input elements.

**New states**

| State | Pseudo-class | Most relevant for |
|---|---|---|
| Focus visible | `:focus-visible` | Keyboard navigation focus rings — preferred over `:focus` for accessibility |
| Disabled | `:disabled` | `input`, `button`, `select`, `textarea` |
| Checked | `:checked` | `input[type=checkbox]`, `input[type=radio]` |
| Placeholder | `::placeholder` | `input`, `textarea` — note this is a pseudo-element not pseudo-class |

**Behaviour**

- The state switcher in the panel header expands to show the new states
  contextually — `:disabled` and `:checked` only appear when the
  selected element is an `input`, `button`, `select`, or `textarea`
- `::placeholder` only appears when the selected element is an `input`
  or `textarea` — and the panel in this state shows only typography
  controls since placeholder styling is limited to text properties
- `:focus-visible` is shown for all elements and is flagged with a
  recommended badge to encourage its use over `:focus` for
  accessibility
- All new states follow the same editing model as existing states —
  switch to the state, edit properties, changes write to a
  pseudo-class block in the CSS

**Code output**

```css
.input_a1b2:focus-visible {
  outline: 2px solid #5c6ac4;
  outline-offset: 2px;
}

.input_a1b2:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.input_a1b2::placeholder {
  color: #888888;
}
```

**`parseCode` updates**

- The CSS parser must recognise `:focus-visible`, `:disabled`,
  `:checked`, and `::placeholder` selectors and map them to the
  correct element's state overrides
- Note `::placeholder` uses double colon (pseudo-element) not single
  — the parser must handle both `::placeholder` and the legacy
  `:placeholder` form

---

## 8. Advanced CSS Grid

**User story**

As a user building complex grid layouts, I want to define named grid
areas, use `grid-template-areas`, and place elements using named lines
from the WYSIWYG panel so I can design structured grid layouts visually
without writing complex grid syntax manually.

**Behaviour**

**Grid template areas (container)**

When a container is set to `display: grid`, an "Areas" sub-section
appears below the existing grid template columns/rows controls:

- A visual grid area editor — a table-like UI where the user can click
  cells and type area names to define regions
- Named areas are shown as colored blocks overlaid on the cell grid
- The editor generates the `grid-template-areas` value automatically:
  ```css
  grid-template-areas:
    "header header header"
    "sidebar main main"
    "footer footer footer";
  ```
- Area names must be valid CSS ident values — validate on input

**Grid area (child elements)**

When an element's parent is a grid container with named areas:

- A "Grid area" dropdown appears in the Layout section showing all
  named areas defined on the parent
- Selecting an area sets `grid-area: header` on the child
- When `grid-area` is set the existing `grid-column` and `grid-row`
  inputs are hidden — they are redundant when a named area is used

**Named line references**

The existing `grid-column` and `grid-row` free-text inputs already
accept named line references (`sidebar-start / main-end`) since they
are free-form. No new UI is needed — just ensure the parser handles
named line values correctly and preserves them verbatim if they cannot
be mapped to a simple span value.

**`parseCode` updates**

- `grid-template-areas` added to the property map — parsed back into
  the visual grid area editor state
- `grid-area` (named area shorthand) added to the property map
- Named line references in `grid-column` and `grid-row` preserved
  verbatim via `customProperties` if they cannot be simplified

---

## 9. Multi-layer backgrounds

**User story**

As a user designing complex backgrounds, I want to layer multiple
background images and gradients on a single element from the WYSIWYG
panel so I can create rich visual treatments without writing
multi-layer background CSS manually.

**Behaviour**

The Background section is extended to support multiple layers.

A "+ Add background layer" button appends a new layer row. Layers are
stacked from top to bottom — the first layer in the list renders on top,
the last renders closest to the background color. Layers are reorderable
via drag-and-drop.

Each layer has a type selector:

| Type | Controls |
|---|---|
| Image | File picker (copies to `public/assets/`), background-size, background-position, background-repeat |
| Linear gradient | Direction (angle or keyword), color stops (add/remove, drag to reorder, color + position per stop) |
| Radial gradient | Shape (circle/ellipse), position, color stops |
| Conic gradient | Angle, position, color stops |

The existing single background image control is replaced by this
multi-layer system. Existing projects with a single `background-image`
value are loaded correctly as a single-layer background.

**Code output**

```css
.rect_a1b2 {
  background-image:
    linear-gradient(135deg, rgba(0,0,0,0.4) 0%, transparent 60%),
    url('/assets/hero.jpg');
  background-size: cover, cover;
  background-position: center, center;
  background-repeat: no-repeat, no-repeat;
}
```

**`parseCode` updates**

- The CSS parser must handle comma-separated multi-value
  `background-image`, `background-size`, `background-position`, and
  `background-repeat` properties
- Each comma-separated value is parsed into a separate layer object
- Linear, radial, and conic gradient values are parsed back into their
  color stop and direction/position parameters
- Unrecognised background layer types preserved verbatim in
  `customProperties`

---

## 10. Clip-path

**User story**

As a user designing shaped elements, I want to apply a clip-path to any
element from the WYSIWYG panel so I can create non-rectangular shapes,
reveal effects, and masked layouts visually without writing clip-path
syntax manually.

**Behaviour**

A "Clip path" section appears in the WYSIWYG panel below Filters.

**Preset shapes**

A grid of preset shape buttons for the most common use cases:

| Preset | CSS output |
|---|---|
| None | removes `clip-path` |
| Circle | `clip-path: circle(50%)` |
| Ellipse | `clip-path: ellipse(50% 40% at 50% 50%)` |
| Triangle | `clip-path: polygon(50% 0%, 0% 100%, 100% 100%)` |
| Diamond | `clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)` |
| Chevron left | `clip-path: polygon(...)` |
| Chevron right | `clip-path: polygon(...)` |

**Inset (rectangular clip)**

An "Inset" mode shows four number inputs (top/right/bottom/left) and
an optional border-radius input:

```css
clip-path: inset(10px 20px 10px 20px round 8px);
```

**Custom polygon editor**

A "Custom polygon" mode shows:
- A visual point editor overlaid on a miniature preview of the element
- Points are shown as draggable handles
- Add point: click on the edge between two existing points
- Remove point: double-click an existing point
- Point coordinates shown as percentage values in a list below the
  preview, editable as text inputs

**Free-form input**

A "Custom CSS" text input accepts any valid `clip-path` value verbatim
for cases not covered by the visual tools — `path()`, `url()`, named
SVG clipPath references.

**`parseCode` updates**

- `clip-path` added to the property map
- `inset()`, `circle()`, `ellipse()`, and `polygon()` values parsed
  back into their respective editor modes
- `path()` and `url()` values preserved verbatim and shown in the
  custom CSS input
- Unrecognised values fall back to the custom CSS input and are
  preserved in `customProperties`

**Notes**

- The custom polygon editor is the most complex UI in this story —
  ship the preset shapes and inset mode first, add the polygon editor
  as a follow-up
- Clip-path on an element with `overflow: visible` can cause
  unexpected results — a tooltip noting this is useful
- `clip-path` and `mask` share similar concepts but are separate
  properties — `mask` is out of scope for this story