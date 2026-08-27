# Canvas / preview parity — Plan

Status: **proposed** — for review.

## The requirement

The canvas and the preview must show the same thing. Always — not
"usually", not "for the properties we've gotten around to". A design tool
whose canvas lies is not a design tool.

Today they diverge, and they diverge *by construction*. This plan is
about removing the mechanism that makes divergence possible, and then
proving parity holds with a test rather than waiting for a user to
notice.

It also covers the second half of the problem the podcast project
exposed: a faithful canvas that faithfully shows a bad layout still
leaves the user with a bad layout. Agents need a feedback loop, not just
a rulebook.

---

## Why this keeps happening

There are two renderers, reading two different sources:

| | Canvas | Preview |
|---|---|---|
| Source | the element model | the generated `.css` file |
| Renderer | `elementToStyle` → React inline styles | a real browser |
| Divergence | whenever the translation is imperfect | n/a — it's the truth |

Every parity bug found so far is the same bug wearing a different hat:
**`elementToStyle` re-derives what the generator already wrote.** Each
property is an independent opportunity to be subtly wrong, and there are
dozens of them.

Two recent examples, both the same shape:

- Cross-axis stretch became `align-self: stretch`, overriding the
  parent's `align-items` — canvas left-aligned, preview centred.
  ([note](../notes/canvas-cross-axis-stretch.md))
- Main-axis stretch became `flex: 1` — basis 0, not `width: 100%`. On
  the podcast hero: canvas 396px at x=1012, browser 804px at x=604.
  ([note](../notes/canvas-flex-main-axis-stretch.md))

Fixing them one at a time is an endless queue. The next one is already
in the code.

## What the canvas cannot express at all

Worse than the translation bugs: some CSS has no inline-style form, so
the canvas doesn't render it *at any fidelity*.

- **`customSelectorBlocks` are never rendered.** They're parsed,
  preserved, and written back to the file — but nothing in
  `src/renderer/src/` reads them. So `::before` / `::after` content,
  `> *`, `:nth-child`, and every hand-written selector is **invisible on
  the canvas and visible in the preview**.

  The generated `agent.md` actively tells agents to use `::before` for
  decorative badges. We are instructing agents to produce something our
  canvas cannot show.

- **`:hover` / `:active` / `:focus` are simulated**, and only for the
  selected element via the State Switcher. In a browser, hovering any
  element applies its hover rule. On the canvas, nothing happens.

- **Breakpoints are re-derived** through `breakpointCascade` rather than
  being real `@media` rules evaluated at the frame's width.

- **`@keyframes` needed a workaround already** — `CanvasKeyframes` in
  `Viewport.tsx` injects a `<style>` tag because animations can't be
  inline. That workaround is the shape of the real fix.

---

## The decision: the canvas renders the generated CSS

Stop translating. Inject the exact stylesheet `generateCode` produces and
let the browser apply it by class name, the way the preview does. The
canvas *is* a browser; the bug is that we keep it from acting like one.

```
            ┌── generateCode ──┬──→ page.module.css ──→ preview (browser)
element ────┤                  │
  model     └──────────────────┴──→ <style> in canvas ──→ canvas (browser)
```

Same text, same engine, same result. Parity stops being a property we
maintain and becomes one we can't easily break.

What this buys immediately, with no extra work per feature:

- `::before` / `::after` and every custom selector start rendering
- real `:hover` / `:focus`, for every element, not just the selected one
- `@media` evaluated at the frame width — delete the cascade re-derivation
- new CSS properties work on the canvas the day the parser learns them

`elementToStyle` shrinks to a small, explicitly enumerated set of
**canvas-only affordances** — the root min-height floor, the instance
wrapper, drag/resize transients — each of which is a deliberate
difference from the preview rather than an accidental one.

### Scoping: keep the page's CSS off Scamp's own UI

The injected stylesheet must not leak into the app chrome. Three options:

1. **`@scope (#scamp-canvas)`** — modern Chromium supports it, and unlike
   a descendant prefix it doesn't add specificity, so the cascade
   resolves exactly as it does in the preview. Cheapest change.
2. **Shadow DOM** for the canvas subtree — real isolation; React can
   render into it, but measuring and hit-testing need review.
3. **An iframe**, which is what the preview effectively is — maximum
   fidelity, largest change: selection, drag, and overlays all have to
   cross the boundary.

I lean **(1) `@scope`**, falling back to (2) if leakage or specificity
surprises show up. (3) is the honest end-state but is a much bigger
rewrite and shouldn't gate the parity win.

### Component instances

Already solved, in a different context. The HTML exporter expands each
instance and prefixes the component's CSS per instance
(`prefixCss` + `collectExpandedInstances` in
`lib/htmlExportCss.ts` / `lib/generateHtml.ts`). The canvas needs exactly
the same transform, so this is reuse, not new design.

### Live editing performance

Regenerating the stylesheet on every drag frame would be wasteful. Two
mitigations, in order of preference:

- Regenerate on **commit** (drag end, property change), not per frame.
- During a drag, apply the transient value as an inline style on the one
  element being manipulated — a bounded, deliberate exception that ends
  when the drag does.

This needs measurement before we commit to a strategy; see open
questions.

---

## Proving it — the parity harness

The architecture makes divergence unlikely. The harness makes it
*visible*, and is the part that turns "always" into something real.

For each fixture page:

1. Generate its TSX + CSS.
2. Render it on the Scamp canvas (Electron, via Playwright).
3. Render the same generated files in a plain browser.
4. Compare the geometry of **every element** — x, y, width, height —
   within a tolerance, and fail on any mismatch.

Geometry rather than pixels, at least to start: it's stable across font
rendering and antialiasing, and it catches exactly the class of bug we
keep hitting. Pixel diffing can come later for paint-level properties
(shadows, filters, blend modes).

The fixture corpus is the deliverable that keeps paying: flex row and
column, stretch with and without sized siblings, `max-width` with
`align-items`, absolute children, grid, `::before` content, hover, each
breakpoint, component instances, nested instances. Every parity bug we
have ever fixed gets a fixture, so it can't come back.

This runs in CI. A regression fails the build instead of reaching a user.

---

## The other half: helping agents build good layouts

The podcast hero was **two** problems. We fixed ours; the user still has
a bad hero, because the CSS an agent wrote puts a decorative glow in
flow, where it eats 470–980px of the row *in the browser too*.

Rules alone haven't worked — `agent.md` already says absolute positioning
is for overlays and decorative layers, and the agent still did this. What
agents lack is **feedback**: something that tells them the result is
wrong so they can fix it.

### A layout validator

A pure function over the element model plus measured canvas geometry,
reporting concrete problems:

| Check | Why it matters |
|---|---|
| Decorative element in flow (no text, no children, background/gradient, sized, inside a flex container) | The podcast hero exactly |
| A fixed-size sibling next to a `width: 100%` sibling | Silently steals the fluid child's space |
| Content wider than its container | Overflow the user may not scroll to see |
| Text clipped by its box | The clipped "Designable" |
| Element fully outside its parent's painted area | Almost always a mistake |

Surfaced in three places, because different agents reach for different
things:

- **In-app** — an Issues panel, so the *user* sees it too, with a
  one-click fix where the fix is unambiguous ("make this absolute").
- **MCP** — `scamp_check_layout`, so an agent can verify its own work
  before declaring done.
- **The context file** — so file-reading agents get it without tool
  calls.

The measured checks are the valuable ones. "Is this text clipped" cannot
be answered by reading CSS; it needs a real layout, and we have one.

### `agent.md`

Already updated with the decorative-layer rule and the fixed-vs-fluid
sibling rule, in both variants. Worth adding once the validator exists:
a short "verify your work" section pointing at `scamp_check_layout`, so
the rulebook and the feedback loop reinforce each other.

---

## Phases

**Phase 0 — unblock the user.** Fix the podcast project's hero (make the
glow absolute). Small, immediate, and separate from everything below.

**Phase 1 — the harness, before the rewrite.** Build the parity test
against *today's* renderer. It will fail on cases we already know about,
and that's the point: it establishes the baseline and proves the harness
detects real divergence rather than passing vacuously.

**Phase 2 — inject the generated CSS.** Scoping decision, instance
prefixing, canvas-only affordance layer. Phase 1's harness measures the
progress.

**Phase 3 — delete the re-derivation.** Retire `elementToStyle`'s
translation branches, the breakpoint cascade re-derivation, and the state
simulation, replacing each with the real CSS mechanism. Each deletion is
verified by the harness.

**Phase 4 — the validator**, in-app panel, MCP tool, context file.

**Phase 5 — pixel diffing** for paint-level fidelity, once geometry
parity is locked in.

Phases 1–3 are the hard requirement. 4 is what makes agent-built projects
good rather than merely faithfully rendered.

---

## Risks

- **Phase 2/3 touch the most load-bearing code in the app.** Mitigated by
  building the harness first and by the existing 2337 unit tests, but
  this is genuinely the riskiest change proposed to Scamp so far.
- **Performance during live manipulation** is unmeasured. If
  regenerate-on-commit isn't fast enough, the transient-inline-style
  exception grows, and every exception is a place divergence can hide.
- **`@scope` support and specificity behaviour** need verification in the
  exact Electron Chromium version we ship.
- **The validator can be annoying.** A checker that cries wolf gets
  ignored. Each rule needs a real failure behind it, and anything
  heuristic should be a hint rather than an error.
- **Some divergence is legitimate** — the canvas frame, selection
  overlays, the root min-height floor. These must be an explicit,
  reviewed list, not an open-ended escape hatch.

## Open questions

1. **How much do you want Phase 0 now?** I can fix the podcast hero in a
   couple of minutes, independently of this plan. go for it
2. **Scoping approach** — `@scope`, shadow DOM, or commit to the iframe
   end-state now? I lean `@scope`; the iframe is more correct and much
   more work. lets try @scope
3. **Is geometry-only parity enough to start**, or do you want pixel
   diffing in the first cut? Geometry catches everything we've hit so
   far and is far less brittle. yeah lets go with geometry then
4. **How loud should the validator be?** Silent until asked, a passive
   badge, or something that interrupts? I lean a passive Issues count
   that opens a panel — visible, not nagging. passive is good
5. **Scope of the first release.** Phases 1–3 are a big piece of work.
   Would you rather have parity landed first and the validator later, or
   a thinner slice of both? lets do both and we will have them in the same release
