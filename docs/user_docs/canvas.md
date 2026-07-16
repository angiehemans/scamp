# Canvas

The canvas is your main workspace — a scrollable viewport where you draw elements that become real code. A floating toolbar sits above it with the drawing tools, and a page-size control pins to the top of every artboard.

## Drawing Elements

- Press **R** to activate the rectangle tool. Click and drag to draw a rectangle.
- Press **T** to activate the text tool. Click to place a text element.
- Press **I** to activate the image tool. Pick a file, then draw a frame.
- Press **F** to activate the input tool. Click and drag to place a form input.
- Press **V** to switch back to the select tool.

See [Elements](elements.md) for the full list of HTML tags each tool can produce and how to change an element's tag after placing it.

## Selecting Elements

- Click any element to select it. Its properties appear in the [Properties Panel](properties-panel.md).
- Click empty canvas space to deselect.
- Click the **page-name badge** above the canvas to select the page root — a Figma-style shortcut to edit page-level styles (background, flex layout, padding).
- Selected elements show resize handles at their corners and edges.

## Moving and Resizing

- **Move** — Click and drag a selected element to reposition it.
- **Resize** — Drag any handle on a selected element to change its size.
- **Nudge** — Arrow keys move by 1px; **Shift+Arrow** moves by 10px.

Drags and resizes clamp to the visible page, so an element can't disappear off-screen. When you're editing at a non-desktop [breakpoint](breakpoints.md), these actions write to that breakpoint's override instead of the base styles.

## Duplicating and Deleting

- **Cmd+D** — Duplicate the selected element.
- **Delete** or **Backspace** — Remove the selected element.

## Canvas Size

The canvas-size control sits just above the canvas, to the right of the page-name badge. It shows the current width (e.g. `Desktop · 1440`) and opens a popover with:

- **Breakpoints** — preset buttons for each project breakpoint. Clicking one resizes the canvas AND switches the active breakpoint for editing. See [Breakpoints](breakpoints.md) for the full responsive workflow.
- **Custom width** — type any width between 100 and 4000 pixels. Custom widths drop the active breakpoint back to Desktop so edits target the base CSS.
- **Clip content** — hide anything that extends past the canvas edge, so the artboard behaves like `overflow: hidden`. See [Overflow and Boundaries](#overflow-and-boundaries) below.
- **Fixed height** — pin the artboard to an exact height (e.g. `900`) to simulate a specific screen. Off by default, the page grows with its content.

Canvas width lives in your project's `scamp.config.json` — it's a design-tool preference, not part of your page's CSS.

## Overflow and Boundaries

The canvas edge is a real viewport boundary, which matters most when you design a desktop layout and then shrink to a mobile width.

- **Overflow indicator** (default) — when any element spills past the canvas width, a faint **amber** dashed line marks the edge with a label of how much overflows (e.g. `+ 240px`). The same appears on the bottom edge when **Fixed height** is on and content runs past it.
- **Clip content** — flip it on (in the canvas-size popover) and everything beyond the boundary is hidden, so you see exactly what a viewport of that size shows. The indicator disappears because nothing spills anymore.
- The clip setting is **remembered per breakpoint** — turning it on at mobile width doesn't force it on at desktop, and vice-versa.

A common mobile workflow: switch the canvas to a mobile width (e.g. 390px), watch the amber indicator show how far your desktop content overflows, turn **Clip content** on to see the visible frame, then apply [breakpoint](breakpoints.md) overrides until the content fits and the indicator shrinks away.

The indicator, the clip toggle, and fixed height are **canvas viewing aids only** — none of them touch your CSS or page files. (One knock-on: a PNG/PDF [export](export.md) taken with clip on captures just the visible canvas area.)

## Scrolling and Zoom

The scrollbars are at the artboard edges. Scroll in any direction — the floating element toolbar stays pinned at the top, and the canvas content moves freely behind it. This matches Figma, Sketch, and other design tools.

| Shortcut | Action |
|---|---|
| **Cmd+=** | Zoom in one step |
| **Cmd+-** | Zoom out one step |
| **Cmd+0** | Reset zoom to fit |

Blank projects show a 1440×900 white page by default. As you add content, the page grows vertically — tall pages scroll inside the artboard like a real browser window.

## Keyboard Shortcut Summary

| Key | Tool |
|---|---|
| **V** | Select |
| **R** | Rectangle |
| **T** | Text |
| **I** | Image |
| **F** | Input |

For the full list, see [Keyboard Shortcuts](keyboard-shortcuts.md).
