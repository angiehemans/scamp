# Scamp — Feature Backlog v7

User stories ordered easiest to hardest.

---

## 1. Locked aspect ratio resize ✅ DONE

**User story**

As a user resizing an element on the canvas or editing its width and
height in the WYSIWYG panel, I want to lock the aspect ratio so that
changing one dimension automatically scales the other proportionally,
so I can resize elements without distorting them.

**Behaviour — canvas resize handles**

- A lock icon appears between the width and height inputs in the Size
  section of the WYSIWYG panel
- When unlocked (default): width and height resize independently as
  they do today
- When locked: changing width recalculates height to maintain the
  current ratio, and vice versa
- The lock state persists per element for the session — if a user
  locks the ratio on an element, it stays locked when they click away
  and come back
- The lock icon also appears as a small overlay on the canvas selection
  handles when an element is selected — clicking it toggles the lock
  without opening the panel
- When dragging a corner resize handle with ratio lock on, the element
  scales proportionally from the corner. Edge handles (top, bottom,
  left, right) are disabled when ratio lock is on — only corner handles
  are active

**Behaviour — panel inputs**

- Width and height inputs show a chain-link icon between them when
  locked:
  ```
  Width   [ 400  px ]  🔗  Height  [ 300  px ]
  ```
- Typing a new width value and pressing Tab recalculates height
  immediately before focus moves to the height field
- The ratio is calculated from the element's dimensions at the moment
  the lock is enabled — it does not change unless the lock is toggled
  off and on again

**Notes**

- Ratio lock state is UI state only — it is not written to the CSS
  file or the element model. It does not persist between sessions
- When an element switches from fixed to stretch sizing on one axis,
  the ratio lock is automatically disabled since stretch sizing is
  percentage-based and cannot be ratio-locked against a fixed value

---

## 2. Canvas overflow and boundary visibility ✅ DONE

**User story**

As a user designing layouts at desktop size who wants to also apply
mobile styles, I want to clearly see the boundary of the canvas when
content overflows it and have the option to clip content at the canvas
edge so I can design within a specific viewport size and understand
exactly what is visible and what is not.

**Behaviour — overflow visibility**

- By default the canvas shows a subtle boundary indicator when any
  element extends beyond the canvas viewport width — a faint dashed
  line at the canvas edge with a small label showing the overflow
  amount:
  ```
  ┌──────────────────────────────────────────────────┐
  │                                                  │
  │  [content]                                       │
  │                               ╎ + 240px overflow │
  │  [element that overflows ─────╎──────────────────]
  │                               ╎                  │
  └──────────────────────────────────────────────────┘
  ```
- The overflow indicator is shown in a warning color (amber) so it
  is clearly distinguishable from normal canvas chrome

**Behaviour — overflow hidden toggle**

- A "Clip content" toggle appears in the canvas settings popover in
  the toolbar (the same place canvas width and breakpoint presets live)
- When clip content is on: content that extends beyond the canvas
  boundary is hidden — the canvas behaves like `overflow: hidden`
- When clip content is off (default): content is visible beyond the
  boundary with the overflow indicator shown
- The clip setting is saved per canvas size preset — turning it on
  at mobile width stays on when the user switches back to desktop
  width only if they also enabled it there

**Mobile and breakpoint design workflow**

This feature is particularly important for designing mobile styles on
a layout that originated at desktop size. When the user switches the
canvas to mobile width (390px):

- Content that was designed at 1440px overflows the 390px canvas
  significantly
- The overflow indicator shows clearly how much is outside the
  viewport
- Clip content on helps the user see exactly what a 390px screen
  shows
- The user applies media query overrides (features-v2 story 6) to
  bring content within the mobile canvas boundary
- As styles are applied the overflow indicator shrinks until content
  fits within the boundary

**Canvas height**

- Canvas height grows with content (as defined in features-v2 story 5)
- The vertical boundary is indicated by a subtle horizontal rule at
  the natural document height when clip content is on
- A "Fixed height" toggle in canvas settings lets users set an exact
  canvas height (e.g. 900px) to simulate a specific screen size — the
  vertical overflow indicator appears the same way as horizontal

**Notes**

- The overflow indicator and clip toggle are canvas UI only — they do
  not affect the CSS output or the project files in any way
- Clip content on does not add `overflow: hidden` to the root element's
  CSS — it is purely a canvas viewing mode
- When exporting (PNG/PDF) with clip content on, the export respects
  the clip boundary — only the visible canvas area is captured

---

## 3. SVG colour editing and resize improvements ✅ DONE

**User story**

As a user who has imported an SVG image using the image import flow,
I want to edit the colours inside the SVG and resize it with a locked
aspect ratio, so imported SVGs behave consistently with SVGs I have
pasted directly into the canvas.

**Context**

Scamp currently supports two SVG workflows:

1. **Pasted SVG** — raw SVG source pasted into the SVG element's
   source textarea in the Element section. The SVG renders inline and
   colours are editable because the source is accessible.
2. **Imported SVG** — an SVG file dragged in via the image import flow.
   Currently treated as an `<img src="/assets/file.svg">` which renders
   the SVG as an opaque image — colours and internals are inaccessible.

This story upgrades imported SVGs to inline rendering to unlock the
same editing capabilities as pasted SVGs.

**Behaviour — imported SVG upgrade**

When a user imports an SVG file via the image import flow:

- Scamp reads the SVG file contents at import time
- The SVG source is stored in the element model alongside the file
  reference
- The element renders as an inline `<svg>` in the canvas rather than
  an `<img>` tag
- The TSX output uses an inline SVG rather than an img src:
  ```tsx
  <div data-scamp-id="a1b2" className={styles.rect_a1b2}>
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="..." fill="#5c6ac4" />
    </svg>
  </div>
  ```
- The SVG source file is still copied to `public/assets/` for
  reference, but the rendered output uses the inline version

**Behaviour — SVG colour editing**

When an SVG element is selected (whether pasted or imported):

- The Element section of the WYSIWYG panel shows a "SVG Colours"
  sub-section
- Scamp parses the SVG source and extracts all unique colour values
  used in `fill`, `stroke`, and `color` attributes and `style`
  properties
- Each unique colour is shown as an editable swatch:
  ```
  SVG Colours
  ● #5c6ac4   [ colour picker ]
  ● #ffffff   [ colour picker ]
  ● #111111   [ colour picker ]
  ```
- Changing a colour updates every occurrence of that colour in the
  SVG source simultaneously
- The updated SVG source is written back to the element model and
  the canvas re-renders
- Colours that use `currentColor` are shown as a special swatch
  that maps to the element's CSS `color` property — editing it
  changes the CSS `color` value rather than the SVG source

**Behaviour — SVG resize with locked ratio**

- SVG elements have the ratio lock (story 1) enabled by default when
  first placed on the canvas — SVGs almost always need to scale
  proportionally
- The ratio is derived from the SVG's `viewBox` attribute
- Resizing respects the viewBox ratio automatically when lock is on
- The user can unlock the ratio to stretch the SVG if needed

**Behaviour — SVG file update**

If the original SVG file in `public/assets/` is updated externally
(by an agent or in a text editor), Scamp detects the change via
chokidar and offers to reload the SVG source:

```
SVG file updated externally.
[ Reload SVG ]   [ Keep current ]
```

Reloading replaces the inline SVG source with the updated file
contents. Any colour edits made in Scamp are lost on reload — a
warning makes this clear.

---

## 4. Component slots (children prop) ✅ DONE

**User story**

As a user building a reusable component, I want to define one or more
slots in my component where other elements or components can be nested,
so my components work like real React components with a `children` prop
and I can compose complex layouts from smaller pieces.

**Context**

Currently Scamp components are self-contained — you cannot pass
elements into them from the outside. This story adds slot support,
which maps directly to React's `children` prop and named slot patterns.

**Behaviour — defining a slot**

In the component editor, a user can designate any container element
as a slot:

- Right-click any rectangle element in the component editor and
  select "Make slot"
- The element is marked as a slot and shown with a distinctive
  visual treatment in the canvas (dashed border, slot label)
- A slot placeholder is shown inside the element:
  ```
  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
     ✦ slot: children
  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
  ```
- The slot can be renamed in the Data tab — the default name is
  `children`. A second slot must have a different name (e.g. `header`,
  `footer`, `icon`)
- A component can have multiple named slots but only one unnamed
  (default) slot

**Default (children) slot — generated code:**

```tsx
type CardProps = {
  children?: React.ReactNode;
};

export default function Card({ children }: CardProps) {
  return (
    <div className={styles.root}>
      <div className={styles.rect_a1b2}>
        {children}
      </div>
    </div>
  );
}
```

**Named slots — generated code:**

```tsx
type SplitLayoutProps = {
  left?: React.ReactNode;
  right?: React.ReactNode;
};

export default function SplitLayout({ left, right }: SplitLayoutProps) {
  return (
    <div className={styles.root}>
      <div className={styles.rect_a1b2}>
        {left}
      </div>
      <div className={styles.rect_c3d4}>
        {right}
      </div>
    </div>
  );
}
```

**Behaviour — using a slot on a page**

When a component with slots is placed on a page canvas:

- The slot area is shown as an empty drop zone on the canvas:
  ```
  ┌──────────────────────────────┐
  │  Card                        │
  │  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
  │     Drop elements here      │ │
  │  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
  └──────────────────────────────┘
  ```
- The user can drag any element or component from the canvas or
  layers panel and drop it into the slot
- Elements dropped into a slot become children of that component
  instance on the page — they are not part of the component
  definition, they belong to the page
- Multiple elements can be dropped into a slot — they are rendered
  as siblings inside the slot

**Generated page TSX with slot content:**

```tsx
import Card from '@/components/Card/Card';
import Button from '@/components/Button/Button';

export default function Home() {
  return (
    <div className={styles.root}>
      <Card data-scamp-instance-id="inst_a1b2">
        <div className={styles.rect_e5f6}>
          <Button label="Get started" />
          <Button label="Learn more" />
        </div>
      </Card>
    </div>
  );
}
```

**Named slot usage on a page:**

Named slots are filled by wrapping slot content in a dedicated prop:

```tsx
<SplitLayout
  data-scamp-instance-id="inst_c3d4"
  left={
    <div className={styles.leftContent}>
      <p className={styles.heading}>Hello</p>
    </div>
  }
  right={
    <img src="/assets/hero.png" className={styles.heroImage} />
  }
/>
```

**Data tab — slots**

Slots appear in the component's Data tab alongside text props:

```
Slots

  children    [ Default slot ]   ← click to navigate to slot in canvas
  header      [ Named slot   ]
```

On a page instance, the Data tab shows which slots have content and
which are empty:

```
Slots

  children    ● 2 elements    [ Edit slot content ]
  header      ○ Empty
```

**Slot constraints**

- A slot element cannot itself be converted into another slot — no
  nested slots
- A component cannot pass a slot into itself — circular slot
  dependencies are blocked with a clear error
- Removing a slot from a component that has content in it on pages
  shows a warning listing affected instances — the slot content is
  not deleted but becomes detached elements that need to be manually
  placed

**`parseCode` updates**

- The TSX parser must recognise `{children}` and `{propName}` JSX
  expressions in component definitions and map them to slot
  definitions
- On page files, JSX children of component instances are parsed
  as slot content and associated with the correct slot name
- Named slot props using JSX expression syntax (`left={<div>...</div>}`)
  are parsed back into named slot content

**Notes**

- Slots are the foundation for building real design systems in Scamp —
  a Card component with a children slot is far more flexible than a
  Card with hardcoded content
- The slot drop zone interaction on the page canvas is the most complex
  UI in this story — it requires detecting drops onto component
  instance areas and routing them to the correct slot
- For named slots the user needs a way to indicate which slot they are
  dropping into — a slot selector appears when the user drags over a
  component instance that has multiple named slots
- This feature depends on the components feature (feature-components.md)
  being complete first