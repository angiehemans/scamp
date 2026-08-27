# Gradient builder in the colour picker — Plan

Status: **proposed** — for review.

## Context

Scamp can now *render* gradients on the canvas — that was a rendering
bug, fixed separately ([note](../notes/canvas-gradient-backgrounds.md)).
This plan is the authoring half: letting a user build one without writing
CSS.

Today a gradient can only arrive by hand-editing the CSS file or by
having an agent write it. The user can see it, but the panel offers no
way to make or change one — so the moment they want a gradient they leave
the tool.

---

## What already exists

- **The model already holds it.** `element.backgroundColor` stores
  whatever the `background:` shorthand contained, gradient included, and
  round-trips it. No schema change is needed to *store* a gradient.
- **`ColorInput`** is a popover with tabs (`PopoverTab`), already
  handling per-tick preview during a drag, history tagging, project
  swatches, and theme tokens. A gradient editor is a new mode inside a
  control that already has the hard parts.
- **`BackgroundSection`** already models a *second* background concept:
  an uploaded image in `customProperties['background-image']`, with its
  own add/remove flow, shown alongside the colour.
- **`parsers.ts`** is the established pattern for this shape of problem —
  a pure parse/format pair for a CSS shorthand, fully tested, with
  unparseable input preserved verbatim rather than discarded.
- **Token resolution** already follows `var(--x)` chains, and the canvas
  now resolves gradient tokens through the non-colour chain so one
  missing token doesn't blank the whole gradient.

---

## The tension to resolve first

A CSS gradient **is** a `background-image`. But Scamp already has two
places a background can live:

| Concept | Stored as | Emitted as |
|---|---|---|
| Colour | `element.backgroundColor` | `background: <colour>` |
| Uploaded image | `customProperties['background-image']` | `background-image: url(…)` |
| Gradient (today) | `element.backgroundColor` | `background: <gradient>` |

So a gradient currently lands in the *colour* field, and an image in a
different field entirely. They can coexist in CSS — an image over a
colour is meaningful — but "gradient in the colour slot" is confusing to
model and to explain, and a gradient plus an uploaded image would fight
over which paints on top.

### Decision: keep the gradient in `backgroundColor`, rename the concept

Storing it where the parser already puts it avoids a migration, keeps the
round-trip text-stable, and means agent-written gradients are editable
the moment this ships. What changes is the *presentation*: the field
stops being "background colour" in the UI and becomes **Background**,
with a type switch:

```
Background   [ Colour | Gradient | Image ]
```

- **Colour** and **Gradient** both write `element.backgroundColor`
- **Image** stays the existing `customProperties` upload flow

Only one of colour/gradient can be active — they're the same slot — which
is exactly what the CSS says, so the UI stops implying otherwise. An
image can still layer over either, as it does today.

---

## Decisions

### 1. A typed gradient model, parsed from and formatted to CSS

`lib/gradient.ts`, following `parsers.ts`:

```ts
type GradientStop = { color: string; position?: string };
type Gradient =
  | { kind: 'linear'; angle: string; stops: GradientStop[]; repeating: boolean }
  | { kind: 'radial'; shape: string; at: string; stops: GradientStop[]; repeating: boolean }
  | { kind: 'conic'; from: string; at: string; stops: GradientStop[]; repeating: boolean };

parseGradient(css: string): Gradient | null
formatGradient(g: Gradient): string
```

Editing needs structure — you can't drag a stop on a string. `null` for
anything we can't model.

### 2. Unparseable gradients stay editable as text, never rewritten

This is the rule that matters most for agent-built projects. An agent can
write a gradient more exotic than our editor models — colour-interpolation
hints, `in oklch`, multiple stacked layers. Those must not be silently
normalised or dropped.

When `parseGradient` returns null, the Gradient tab shows the raw value in
a text field with a short "this gradient is more complex than the editor
handles — edit it as CSS" note. The value round-trips untouched unless the
user changes it. Same principle as `customProperties`: preserve what we
don't model.

### 3. Stops can reference theme tokens

A stop's colour uses the existing colour control, so `var(--accent)` and
project swatches work in a gradient exactly as they do elsewhere. This is
the main reason to build this into `ColorInput` rather than as a separate
widget — the token picker, the swatches, and the eyedropper are already
there.

### 4. Live preview during a drag

`ColorInput`'s `onPreview` already applies values straight to the canvas
DOM during a drag, bypassing React and Zustand, and commits one history
entry on release. Dragging a gradient stop should reuse that path
verbatim rather than inventing a second one.

### 5. Presets, because a blank gradient editor is a cold start

A small row of starting points (subtle fade, two-tone, radial glow) built
from the project's own tokens where possible. The podcast hero glow is a
good template — a radial fade from an accent to transparent.

---

## Phases

**Phase 1 — `lib/gradient.ts`.** Parse and format, fully tested including
the round-trip invariant and the unparseable cases. Pure; no UI.

**Phase 2 — the Gradient tab.** Stop list with add/remove/reorder, colour
per stop via the existing control, position per stop, angle/shape
controls, live preview, and the raw-text fallback.

**Phase 3 — the Background type switch** in `BackgroundSection`, and the
label change from "Background colour" to "Background".

**Phase 4 — presets**, and a gradient swatch row in the project swatches
so a gradient can be reused across elements.

Phases 1–3 are the feature; 4 is polish that can follow.

---

## Files to touch

**New:** `src/renderer/lib/gradient.ts`,
`src/renderer/src/components/controls/GradientEditor.tsx` (+ module CSS),
`test/gradient.test.ts`, `test/gradientRoundtrip.test.ts`,
`test/e2e/color-picker/gradient.spec.ts`.

**Modified:** `ColorInput.tsx` (new tab), `BackgroundSection.tsx` (type
switch), `docs/user_docs/color-picker.md`, `docs/CHANGELOG.md`, and the
generated `agent.md` — agents should know gradients are first-class and
what shape Scamp round-trips cleanly.

---

## Tests

**`gradient.test.ts`** — every form: linear with and without an angle,
`to right` keywords, radial with shape/size/position, conic with `from`,
`repeating-*`, stops with and without positions, double-position stops,
tokens as stop colours, `rgb(0 0 0 / 50%)` stops (the slash that must not
be mistaken for syntax), and malformed input returning null rather than
throwing.

**`gradientRoundtrip.test.ts`** — `formatGradient(parseGradient(css))`
reproduces the input for everything we claim to model, and unmodelled
input survives untouched through parse → generate.

**e2e** — build a two-stop gradient in the picker, assert the CSS file on
disk and that the canvas shows it; then reopen and confirm the editor
re-populates from the file rather than resetting.

---

## Risks

- **Normalising what we don't own.** The biggest risk is an agent-written
  gradient being silently rewritten into our canonical form. Decision 2
  guards it and the round-trip test enforces it.
- **The colour/gradient slot.** Presenting one field as two modes is
  clearer than today, but a user who sets a gradient and then picks a
  colour will lose the gradient. That needs an undo-able, obvious
  transition — not a silent overwrite.
- **Scope creep into a full background editor.** Multiple layers,
  blend modes per layer, and background position/size are all adjacent
  and all out of scope here.

## Open questions

1. **Does the type switch belong in the section or the popover?** I lean
   the section (`Colour | Gradient | Image` next to the label), because
   it's a property of the background, not of the picker. The alternative
   is a third tab inside the popover, which keeps the section unchanged.
2. **Should gradients be storable as theme tokens?** A `--brand-fade`
   gradient token would be genuinely useful, but tokens are currently
   colour-shaped and the design-system panel assumes that. Probably a
   follow-up, but worth deciding now if it changes the model.
3. **How many stops before the UI needs a different shape?** A simple
   list is fine to ~5; beyond that a gradient bar with draggable handles
   is the usual answer. Start with the list?
4. **Angle input** — a numeric degree field, a dial, or keyword presets
   (`to right`, `to bottom`)? Keywords cover most real use and
   round-trip exactly as written; a dial is nicer but normalises to
   degrees.
