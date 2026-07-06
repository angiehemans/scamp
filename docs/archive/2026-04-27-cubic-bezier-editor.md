# Cubic-Bezier Graphical Editor — Follow-up Plan

**Status:** Backlog. Implement after Transitions (story 1 of `2026-04-27-transitions-and-grid.md`) ships.
**Date:** 2026-04-27

---

## Goal

The Transitions section ships with a `Custom…` entry on the easing dropdown that opens a plain text input for raw `cubic-bezier(a, b, c, d)` values. That covers the use case but isn't friendly — users have to know the four control-point convention and there's no visual feedback. This follow-up adds a small graphical editor: a 200×200 SVG with the standard curve, two draggable control-point handles, and a live preview of the resulting easing.

---

## Behaviour

- Selecting `Custom…` from the easing dropdown opens a popover (matching the existing color/font picker pattern — portaled, click-outside-closes).
- Inside the popover:
  - **SVG curve preview** (200×200): the unit square `(0,0)` bottom-left, `(1,1)` top-right, with the cubic-bezier curve drawn from start to end. Two handle dots at the control points; user drags either one with the mouse.
  - **Numeric inputs**: four `NumberInput` rows for `x1`, `y1`, `x2`, `y2`. Drag updates them, typing updates the curve.
  - **Preset chips** at the top: `ease`, `ease-in`, `ease-out`, `ease-in-out`, `bounce`, `back-in`, `back-out`. Clicking populates the four numbers.
  - **Live animation preview**: a small ball at the bottom that animates left↔right using the current curve, on a 1.5s loop. Helps the user feel the easing.
- Y values can extend past `[0, 1]` (overshoot is meaningful for back/bounce-style curves). X values clamp to `[0, 1]` per the CSS spec.
- Closing the popover commits the value to the transition row's `easing` field as `cubic-bezier(x1, y1, x2, y2)`.

---

## Where it lives

- New `src/renderer/src/components/controls/CubicBezierEditor.tsx`. Self-contained, takes `value: string` (raw CSS expression) + `onChange: (next: string) => void`.
- Reused by `TransitionsSection.tsx` when easing is `Custom…`. Replaces the inline text input.
- Designed so a future Animation section (story 4) can drop it in unchanged for animation timing functions.

---

## Implementation sketch

- **Parsing/formatting**: `parseCubicBezier(value): [x1, y1, x2, y2] | null` and `formatCubicBezier(p): string`. Round-trip clean. Defaults to `[0.4, 0, 0.2, 1]` (Material's standard) if parsing fails so the editor always has something to render.
- **SVG geometry**: cubic Bezier from `(0, 0)` through control points `(x1, y1)` and `(x2, y2)` to `(1, 1)`. Render as a `<path d="M 0,0 C x1,y1 x2,y2 1,1" />` with the unit square mapped onto a 200×200 viewBox (Y inverted because SVG Y axis is flipped vs. CSS easing convention).
- **Drag handles**: `<circle>` per control point, `onPointerDown` captures the pointer and updates the corresponding `(x, y)` while the user drags. `setPointerCapture` for stable drag-while-moving-fast.
- **Numeric inputs**: round to 2 decimals on display, store full precision internally. NumberInput's existing arrow-key stepping handles fine adjustment.
- **Live preview**: a `<div>` with `transform: translateX(...)` and `transition: transform 1.5s var(--easing)` where `--easing` is the current expression. A `setInterval` toggles between `0` and `100%` to keep the loop alive.

---

## Tests

- **Unit:**
  - `test/cubicBezier.test.ts` — parse/format edge cases: well-formed, whitespace variants, malformed (returns null), out-of-range Y (kept), out-of-range X (rejected per spec).
- **E2E:**
  - `test/e2e/properties-panel/cubic-bezier-editor.spec.ts` — open the editor on a transition row, drag a handle, verify the easing value committed back to disk matches the new control points.

---

## Out of scope

- Saving named user presets across projects.
- A full timeline editor (multi-stop easings, that's `linear()` territory in modern CSS).
- Touch input — Scamp is desktop-only; pointer events cover mouse and trackpad.

---

## Open questions for review

1. **Preset chips:** the seven I listed above feel right for a designer audience. Want different ones, or fewer (just the CSS keyword presets)?
2. **Live animation preview:** worth the 30 lines of code, or skip and trust the static curve drawing?
3. **Numeric input precision:** display 2 decimals or 3? The CSS spec accepts more but readability suffers.
