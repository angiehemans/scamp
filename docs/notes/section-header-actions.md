# Section header action cluster

`Section` (WYSIWYG panel) can render up to three icon controls on its title
row:

- **`groupAccessory`** — a preset menu icon (Typography "Text style",
  Shadows preset).
- **`groupToggleButton`** — the eye toggle that flips a CSS-property group
  off/on.
- **`titleAccessory`** — a right-aligned control on non-collapsible sections
  (e.g. Size's ratio-lock). Collapsible sections show the disclosure chevron
  here instead.

## Why they live in one `.titleActions` wrapper

These must appear **grouped and flush-right**. The earlier implementation gave
each icon its own `margin-left: auto`. That works with a single icon, but CSS
flexbox distributes free space **equally across every auto margin** — so a
section with two icons (Typography, Shadows: preset + eye) rendered as
`[title] …… [preset] …… [eye]`, spreading them apart instead of clustering.

Fix: wrap all header icons in a single `.titleActions` flex container. One
`margin-left: auto` on the wrapper pushes the whole group right; the icons
inside stay adjacent via `gap`. The collapse chevron is the last child of
that wrapper on collapsible sections, so it sits at the far edge.

Rule of thumb: never put `margin-left: auto` on more than one sibling in the
same flex row when you want them clustered — push a wrapper, not each item.
