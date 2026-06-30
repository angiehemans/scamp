# CSS Animations (Preset Keyframes) — Plan

**Status:** Draft for review.
**Date:** 2026-05-01
**Source:** `docs/backlog-3.md` story #4
**Related:** transitions (story #1, done — same shorthand-parsing
pattern), per-element states (story #3, done), CSS Variables and
Tokens (already shipped — same page-level passthrough pattern).

## Goal

Let users apply CSS animations to elements from the WYSIWYG panel by
choosing from a curated preset library (`fade-in-up`, `pulse`,
`spin`, …). Selecting a preset writes the `animation` shorthand on
the element and appends the matching `@keyframes` block to the CSS
module. The user gets motion design without writing keyframes by
hand; agent-written keyframes round-trip verbatim.

---

## Current state — what we can build on

Three existing systems supply patterns this story reuses:

- **Transitions** (`element.transitions`,
  `parseTransitionShorthand`, `formatTransitionShorthand` in
  `src/renderer/lib/parsers.ts`). Same shape of problem: parse a
  CSS shorthand into typed fields, emit it back, panel section
  with typed controls (TransitionsSection).
- **Page-level passthrough** (`customMediaBlocks` on the parser
  output, `pageCustomMediaBlocks` on the canvas store, threaded
  through `loadPage` and back into `generateCode`). The same
  pattern fits `@keyframes` blocks — they're top-level CSS that
  doesn't belong to any one element.
- **Per-element states** (`stateOverrides`,
  `customSelectorBlocks`). The "recognise a known shape vs preserve
  verbatim" approach matches what we need for keyframes (preset
  vs custom).

What's NOT there yet:

- No element-level field for `animation`.
- `parseCode` doesn't recognise `@keyframes` at all — the at-rule
  walk only handles `@media`. Top-level keyframes are silently
  dropped.
- The canvas renders a static frame — there's no preview-trigger
  mechanism for animations.

---

## Non-goals for this story

- **Custom keyframes editor.** Per the user story note: agents can
  hand-write `@keyframes` blocks and Scamp preserves them verbatim;
  the panel UI doesn't expose an editor.
- **Multiple animations per element.** CSS allows
  `animation: a 1s, b 2s` (comma-separated). The data model leaves
  room for a list later, but the panel ships with a single-animation
  picker. Multi-animation source is preserved verbatim if the
  parser sees it (see "Multi-animation passthrough").
- **`prefers-reduced-motion` wrapping.** The story flags it as a
  consideration; default OFF for the POC. Could be a project-config
  toggle later that wraps emitted animation blocks (per the story).
- **Per-breakpoint animations** (an animation that runs only at
  `tablet` width and above). The data model deliberately doesn't
  allow `animation` inside `breakpointOverrides` — agent-written
  `@media (max-width: 768px) { .foo { animation: ... } }` round-trips
  via `customMediaBlocks` verbatim, but isn't editable from the
  panel. Per-breakpoint animations rarely help in real designs and
  multiplying axes here adds parser/UX complexity for little payoff.
- **`animation-timeline`, `view-timeline`, scroll-driven
  animations.** Verbatim passthrough only.

---

## Data model

### New types

```ts
// src/renderer/lib/element.ts

/**
 * The names of curated preset animations Scamp ships in its picker.
 * Stored on the element when the user selects from the picker; on
 * round-trip, names matching this list AND with a canonical
 * keyframes body are recognised back to the picker. Anything else
 * is preserved verbatim with `isPreset: false`.
 */
export type AnimationPresetName =
  | 'fade-in'
  | 'fade-in-up'
  | 'fade-in-down'
  | 'slide-in-left'
  | 'slide-in-right'
  | 'scale-in'
  | 'bounce-in'
  | 'fade-out'
  | 'fade-out-up'
  | 'slide-out-left'
  | 'slide-out-right'
  | 'scale-out'
  | 'pulse'
  | 'shake'
  | 'bounce'
  | 'spin'
  | 'ping'
  | 'float'
  | 'wiggle';

export type AnimationDirection =
  | 'normal'
  | 'reverse'
  | 'alternate'
  | 'alternate-reverse';

export type AnimationFillMode = 'none' | 'forwards' | 'backwards' | 'both';
export type AnimationPlayState = 'running' | 'paused';

/**
 * One CSS animation applied to an element. Stored as typed fields so
 * the panel can render proper controls; serialised back to the
 * `animation` shorthand on emit.
 *
 * `isPreset` records whether the name matched the preset library at
 * parse time AND whether the keyframes body matched the canonical
 * preset body — both must be true for the picker to show "Preset:
 * fade-in-up". A preset name with an agent-edited body shows as
 * "Custom (was fade-in-up)".
 */
export type ElementAnimation = {
  name: string; // preset name OR raw name from source
  isPreset: boolean;
  durationMs: number;
  easing: string;        // free text — supports cubic-bezier(...) etc.
  delayMs: number;
  iterationCount: number | 'infinite';
  direction: AnimationDirection;
  fillMode: AnimationFillMode;
  playState: AnimationPlayState;
};
```

### Extended ScampElement

```ts
export interface ScampElement {
  // ... existing fields ...

  /**
   * Single CSS animation applied to this element. Undefined when
   * the element has no `animation` declaration. Multi-animation
   * source (`animation: a 1s, b 2s`) is preserved verbatim via
   * `customProperties.animation` rather than this field — the
   * picker doesn't model the multi case.
   */
  animation?: ElementAnimation;
}
```

### State overrides — animations on `:hover`, `:active`, `:focus`

Per-state animations are explicitly supported (this is a common
pattern: hover triggers a `shake`, active triggers a `pulse`).
Per-breakpoint animations are explicitly NOT supported (rare in
real designs, multiplies axes for little payoff).

To make this asymmetry type-safe, `StateOverride` becomes a strict
superset of `BreakpointOverride`:

```ts
// src/renderer/lib/element.ts

export type StateOverride = BreakpointOverride & {
  /**
   * Per-state animation override. When set, the state's emitted
   * pseudo-class block carries an `animation` declaration that
   * replaces the base's animation while the state is active.
   * Setting `undefined` clears any base animation when the state
   * applies (a hover that explicitly stops a base animation).
   */
  animation?: ElementAnimation;
};
```

Implications:

- `BreakpointOverride` doesn't have `animation` — TypeScript blocks
  any code path that tries to put one there.
- `StateOverride` is assignable to `BreakpointOverride` (it has the
  same required fields plus an optional extra), so the existing
  emit/parse helpers that take `BreakpointOverride` still accept
  state overrides for the shared fields.
- The animation emit branch in `breakpointOverrideLines` only fires
  when `'animation' in override` — only ever true for state
  overrides per the type system.

#### Hover-restart behaviour

When an animation is on `:hover`, CSS triggers it on hover-enter
and re-triggers it every time the user re-enters hover (because
the `:hover` declaration drops on hover-leave). This is fine for
one-shot motion (`shake`, `pulse` once) but weird for infinite
loops (`spin` would reset on every re-hover). The agent.md will
document this so users aren't surprised; the picker won't block
infinite animations on hover but will surface a small inline hint.

### Page-level keyframes

Keyframes are top-level CSS that doesn't belong to any one element —
multiple elements can reference the same `fade-in-up` block, and
removing the block when the last referring element changes its
animation is a separate problem from emitting per-element rules.

Mirroring `customMediaBlocks`, store keyframes on the canvas store
at page level:

```ts
// src/renderer/lib/element.ts (or a new keyframes module)

export type KeyframesBlock = {
  /** The keyframe name as written, e.g. `fade-in-up` or `myCustom`. */
  name: string;
  /** Verbatim declaration block content (the part between the outer
   *  braces, including all rule blocks and comments). */
  body: string;
  /** True when `name` matches a preset AND `body` is byte-equivalent
   *  to the canonical preset body. False for agent-written, edited,
   *  or unknown-named blocks. */
  isPreset: boolean;
};
```

Stored on the canvas store as
`pageKeyframesBlocks: ReadonlyArray<KeyframesBlock>`, threaded
through `loadPage`, `reloadElements`, and back into `generateCode`
exactly like `pageCustomMediaBlocks` is today.

### Preset library

A static module that's the source of truth for both UI metadata and
canonical keyframe bodies:

```ts
// src/renderer/lib/animationPresets.ts

export type AnimationPresetCategory = 'entrance' | 'exit' | 'attention' | 'subtle';

export type AnimationPreset = {
  name: AnimationPresetName;
  category: AnimationPresetCategory;
  /** Short description for the picker. */
  description: string;
  /** Sensible defaults the picker writes when the user selects this
   *  preset. The preset library decides what "sensible" means
   *  per-animation (e.g. `pulse` defaults to `infinite`). */
  defaults: Pick<
    ElementAnimation,
    'durationMs' | 'easing' | 'iterationCount' | 'direction' | 'fillMode'
  >;
  /** Canonical keyframes body. Matched byte-equivalent on parse to
   *  decide `isPreset` on the resulting `KeyframesBlock`. */
  body: string;
};

export const ANIMATION_PRESETS: ReadonlyArray<AnimationPreset> = [/* ... */];
export const PRESETS_BY_NAME: ReadonlyMap<AnimationPresetName, AnimationPreset>;
```

Body comparison is structural (parsed via `postcss`) rather than
literal — `from { opacity: 0; }` and `0% { opacity: 0; }` are
equivalent CSS, so we shouldn't flag a hand-typed equivalent as
"custom." Whitespace and property ordering are normalised before
comparison.

---

## Code emission — `generateCode`

Per-element CSS layout becomes:

```css
.rect_a1b2 {
  background: #fff;
  animation: fade-in-up 300ms ease forwards;
}

.rect_a1b2:hover { ... }

@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}

@media (max-width: 768px) {
  ...
}
```

Order rules (after this story):

1. Per-element chunk (base + state blocks + custom selector blocks).
2. **`@keyframes` blocks** — one per unique name in
   `pageKeyframesBlocks`, in source order.
3. `@media` blocks (breakpoints).
4. `customMediaBlocks` (verbatim).

`@keyframes` lands BEFORE `@media` because real Next.js / agent-
written CSS conventionally puts keyframes near the bottom but above
the media queries that might `animation-name: var(...)` reference
them.

The `animation` shorthand on the element emits in this order so it
matches the most common authoring style:

```
animation: <name> <duration> <easing> <delay> <iteration> <direction> <fill-mode> <play-state>;
```

Default values are omitted (e.g. `delay: 0ms` is not emitted) to
keep output compact. The full shorthand emits when ANY non-default
field is set OTHER than the trailing default. (If `easing: ease` is
followed by `delay: 100ms`, easing must emit because position
matters.) — same rule the existing `formatTransitionShorthand`
follows.

**Per-state animation emit.** When a state override carries an
`animation`, the state's pseudo-class block emits the shorthand
the same way:

```css
.rect_a1b2:hover {
  animation: shake 300ms ease;
}
```

`breakpointOverrideLines` (already shared between state and
breakpoint emit) gains an `animation` branch that fires when
`'animation' in override` — true only for `StateOverride` per the
type system.

Keyframes-block emit:
- Reuse the `body` field verbatim — no re-formatting. The block
  was either a known preset's canonical body (we wrote it on the
  user's first click) or an agent's hand-written content.
- A `@keyframes` block with no element referencing it is still
  emitted — that's the lossless round-trip rule. (The store has a
  separate "garbage-collect unused presets" action the user can
  invoke explicitly; not in this phase.)

---

## Code parsing — `parseCode`

Two new things to recognise:

### `animation` shorthand

`parseAnimationShorthand` lives in `src/renderer/lib/parsers.ts`
alongside `parseTransitionSegment`. Parses one comma-separated
animation definition into an `ElementAnimation`. The shorthand has
8 components in the spec; ordering is mostly free except:

- The first `<time>` is `duration`, the second is `delay` — same
  rule as the transition shorthand.
- `<single-animation-iteration-count>` is either a `<number>` or
  `infinite`.
- `<single-animation-direction>`, `<single-animation-fill-mode>`,
  `<single-animation-play-state>` are mutually disjoint enum sets
  so order between them doesn't matter.
- The animation NAME is a `<custom-ident>` — anything that isn't
  one of the keyword sets above.

Multi-animation case (commas at the top level): the parser falls
back to storing the whole declaration in `customProperties` so the
shorthand round-trips byte-for-byte. The `element.animation` field
stays undefined; the panel shows "Multi-animation source — edit in
CSS mode." This sidesteps modelling the n-ary case.

### `@keyframes` blocks

The at-rule walk in `parseCssDeclarations` (currently `@media`-only)
extends to also collect `@keyframes`:

```ts
for (const node of root.nodes) {
  if (node.type !== 'atrule') continue;
  if (node.name === 'media') { /* existing */ }
  else if (node.name === 'keyframes') {
    keyframesBlocks.push({
      name: node.params.trim(),
      body: serializeKeyframesBody(node),
      isPreset: matchesPreset(node.params.trim(), node),
    });
  }
}
```

`serializeKeyframesBody` is a postcss helper that returns the
declaration list inside the outer braces, normalised for whitespace
where it doesn't affect render but byte-stable on round-trip.

`matchesPreset` does the structural comparison: parse the canonical
preset body and the source body via postcss, walk both trees and
compare keyframe stops (`from`/`0%`, `to`/`100%`, etc.) and
declarations.

Vendor-prefixed keyframes (`@-webkit-keyframes`) — preserved
verbatim via `customMediaBlocks` (they're at-rules the parser
doesn't route). Worth checking the at-rule walk handles them
gracefully; they'll currently fall through to the `else` branch.
I'll add a defensive branch that pushes them to `customMediaBlocks`
explicitly.

### Per-state animations

The state-block parser already routes `:hover` / `:active` / `:focus`
declarations through `applyDeclarationsAsOverride` (returning a
`BreakpointOverride`). For animations we need a state-specific
variant:

```ts
const applyDeclarationsAsStateOverride = (
  decls: RawDeclaration[]
): StateOverride => {
  const base = applyDeclarationsAsOverride(decls);
  // Pull out animation declarations and parse them into the typed
  // field. Multi-animation (commas at the top level) falls through
  // to customProperties just like the base path.
  const animDecl = decls.find((d) => d.prop === 'animation');
  if (!animDecl) return base;
  const parsed = parseAnimationShorthand(animDecl.value);
  return parsed === null ? base : { ...base, animation: parsed };
};
```

The state-block walker swaps `applyDeclarationsAsOverride` for
`applyDeclarationsAsStateOverride`. Per-state animations now
round-trip through the panel.

### `animation` declarations inside `@media` blocks (out of scope)

The existing `@media` walker already detects "non-base class
selectors inside @media" and routes the whole block to
`customMediaBlocks` verbatim. We extend that detection: if any rule
inside the `@media` block has an `animation` declaration on a class
selector, route the whole block to `customMediaBlocks` instead of
risking an animation field landing in `breakpointOverrides` (which
the type doesn't allow). Agent-written per-breakpoint animations
round-trip text-stable but aren't editable.

---

## Properties panel — Animation section

New `AnimationSection` component. Mounted in `UiPanel` for every
element type (animations apply to anything).

### Layout

```
┌──────────────────────────────┐
│ Animation                    │
│ ─────────────────────────    │
│ [ Preset:  fade-in-up   ▾ ]  │  ← searchable dropdown
│ Duration  [300] ms           │
│ Easing    [ease         ▾ ]  │
│ Delay     [0]   ms           │
│ Iteration [1] [∞]            │
│ Direction [normal       ▾ ]  │
│ Fill mode [forwards     ▾ ]  │
│ Play state [▶ Running] [⏸]   │
│ ─────────────────────────    │
│           [▶ Play preview]   │
│           [✕ Remove]         │
└──────────────────────────────┘
```

Empty state (no animation set):

```
┌──────────────────────────────┐
│ Animation                    │
│ ─────────────────────────    │
│ [ Add animation ▾ ]          │
└──────────────────────────────┘
```

### Searchable dropdown

A new `SearchableDropdown` control (or extend `EnumSelect` with a
search input). Options grouped by category — Entrances, Exits,
Attention, Subtle. Search filters by name + description.

### "Add animation" flow

User picks a preset from the dropdown:
1. The patch (with `{ animation: { ...preset.defaults, name, ... } }`)
   routes through `applyPatchWithAxisRouting` exactly like every
   other section's edits — base when default state is active,
   `stateOverrides[activeState]` when a state is active.
2. Either way, ensure a `KeyframesBlock` exists in
   `pageKeyframesBlocks` for that name. If absent, append one with
   the canonical body. If present, leave it as-is (preserves agent
   edits). Same registration logic regardless of which axis the
   animation lands on — the keyframes block is page-level and
   shared.

### Per-state animations

When the state switcher is on Hover (or Active / Focus), the
AnimationSection edits the `stateOverrides[state].animation` field
instead of the base `element.animation`. The picker visually
distinguishes a state animation from a base animation — when
viewing in Hover mode and only base has an animation set, the
section shows the base animation greyed out with "Same as default".

Hover-restart hint: when the user picks an `infinite` iteration on
a state animation, an inline note appears: *"This animation will
restart every time the user re-enters this state. For continuous
loops, set the animation on the default state instead."* No hard
block — power users may legitimately want this.

### "Remove" flow

1. Set `element.animation = undefined`.
2. **Don't** auto-remove the keyframes block — other elements may
   reference it, and even if not, the user might re-apply it. A
   separate "Clean up unused keyframes" action (out of scope for
   this story) handles cleanup.

### Custom / multi-animation states

When `element.animation === undefined` AND the source had a multi-
animation declaration (stored in `customProperties.animation`), the
section shows:

```
┌──────────────────────────────┐
│ Animation                    │
│ ─────────────────────────    │
│ Multi-animation declaration  │
│ — edit in CSS mode.          │
│ [ Replace with picker… ]     │
└──────────────────────────────┘
```

When the parser routed an animation but `isPreset === false` (name
or body doesn't match a preset), the picker shows
`Custom: <name>` and an info tooltip explains the mismatch.

---

## Canvas preview

Per the user story: "A play button in the Animation section
triggers the animation once in the canvas." Implementation:

- `AnimationSection` calls `useCanvasStore.getState().playAnimation(elementId)`.
- The store sets `previewAnimation: { elementId: string, key: number } | null`.
  `key` is incremented on each play so the renderer can use it as a
  React `key` prop and force a remount, restarting the animation.
- `ElementRenderer` reads `previewAnimation`. When it matches the
  rendered element id, the rendered element gets `key={key}` (so a
  click triggers a remount and replays). When `null`, no animation
  plays.
- Animations don't loop on the canvas during normal editing — the
  rendered element omits `animation-iteration-count` (it'd loop
  forever), or sets `iteration: 1` regardless of the user's setting.
  The "Play preview" button is the only way to see motion in the
  editor; preview mode (story #5) will eventually run it for real.
- Setting `playState: 'paused'` in the panel suppresses the preview
  too — the user's choice is "paused" so we honour it.

A follow-up tweak: respect `prefers-reduced-motion` system setting
on the canvas preview itself, so the user's accessibility settings
suppress the preview animation. Cheap to add but flagged as polish.

---

## Implementation phases

### Phase 1 — Types, presets, parser/formatter

1. Add `ElementAnimation`, `AnimationPresetName`, etc. to
   `src/renderer/lib/element.ts`. Extend `ScampElement`.
2. Redefine `StateOverride = BreakpointOverride & { animation?: ElementAnimation }`
   so per-state animations are typed but per-breakpoint animations
   stay rejected at the type level.
3. Add `KeyframesBlock` type.
4. Add `src/renderer/lib/animationPresets.ts` with the curated
   library + canonical bodies.
5. Add `parseAnimationShorthand` and `formatAnimationShorthand` to
   `src/renderer/lib/parsers.ts`. Add `matchesPreset` /
   `normaliseKeyframesBody` helpers.
6. Unit tests for:
   - Each preset's canonical body parses cleanly (no warnings).
   - Round-trip a generated shorthand through parse → format.
   - `matchesPreset` recognises `from`/`to` ↔ `0%`/`100%` equivalence.
   - `parseAnimationShorthand` returns null on multi-animation input.
   - All 8 properties parse out of any spec-allowed order.

**Acceptance:** all existing tests pass; new pure-function tests
pass. No runtime wiring yet.

### Phase 2 — Generator

1. Emit the `animation` shorthand in `elementDeclarationLines`
   when `element.animation` is set. Default-omit fields the same
   way the transition emit does.
2. Add an `animation` branch to `breakpointOverrideLines` so state
   overrides emit their animation shorthand inside the
   pseudo-class block. (Branch is unreachable for actual
   breakpoint overrides per the type system.)
3. Extend `generateCss` to emit `pageKeyframesBlocks` between the
   per-element chunks and the `@media` blocks.
4. Tests:
   - One element with one preset emits the right shorthand AND a
     `@keyframes` block with the canonical body.
   - Two elements referencing the same preset emit the
     `@keyframes` block once.
   - **A state override with an animation emits the shorthand
     inside `:hover` etc.**
   - **A base animation + a hover animation emit two animation
     declarations across the base and hover blocks.**
   - An agent-written keyframes block (custom name OR custom body)
     emits verbatim.
   - Removing an animation from an element doesn't drop the
     keyframes block from the page (intentional — referenced or not).
   - Source order: per-element chunks → keyframes → media →
     custom-media.

**Acceptance:** generator tests pass; round-trip test still passes.

### Phase 3 — Parser

1. Extend `parseCssDeclarations` to walk `@keyframes` at-rules and
   collect them into a `keyframesBlocks` bucket.
2. Route `animation` declarations on a class through
   `parseAnimationShorthand`. Multi-animation source falls through
   to `customProperties.animation` verbatim.
3. After per-element hydration, set `element.animation` from the
   parsed shorthand. Set `isPreset` based on `matchesPreset`
   against `keyframesBlocks`.
4. Add `applyDeclarationsAsStateOverride` that wraps the breakpoint
   helper and additionally parses any `animation` declaration into
   the state override. Switch the state-block walker to use it.
5. Extend the `@media` walker's "non-base detection": if any rule
   inside the @media block has an `animation` declaration on a
   class selector, route the whole block to `customMediaBlocks`
   verbatim (per-breakpoint animations stay out of the typed
   model).
6. Add `keyframesBlocks` to `ParsedTree` so `loadPage` can route
   it into the canvas store.
7. Tests:
   - Parse a preset animation + matching keyframes → `isPreset: true`.
   - Parse a preset name with edited keyframes body →
     `isPreset: false`, animation still set.
   - Parse a custom name → `isPreset: false`.
   - Parse multi-animation → `customProperties.animation` carries
     the full string, `element.animation` is undefined.
   - **Parse `:hover { animation: shake 300ms; }` →
     `stateOverrides.hover.animation` populated.**
   - **Parse `@media { .foo { animation: spin 1s; } }` → whole
     block lands in `customMediaBlocks` verbatim, no breakpoint
     override created.**
   - Round-trip invariant for an element with a preset animation.
   - **Round-trip invariant for an element with hover animation.**
   - Vendor-prefixed `@-webkit-keyframes` round-trip via
     `customMediaBlocks`.

**Acceptance:** parser tests pass; new round-trip tests pass.

### Phase 4 — Store routing

1. Add `pageKeyframesBlocks: ReadonlyArray<KeyframesBlock>` to the
   canvas store (mirroring `pageCustomMediaBlocks`).
2. Thread it through `loadPage`, `reloadElements`, and the sync
   bridge's `generateCode` calls.
3. Add `setAnimation(elementId, animation)` action that:
   - Routes the animation through `applyPatchWithAxisRouting` —
     base when default state is active, `stateOverrides[state]`
     when a state is active. (Type system blocks the `tablet`
     breakpoint route because `BreakpointOverride` doesn't have
     `animation`; the patch routing function silently drops in
     that combo, matching how state×breakpoint combos already
     behave.)
   - Ensures a `KeyframesBlock` exists for the preset name in
     `pageKeyframesBlocks` regardless of which axis the animation
     landed on. Keyframes are page-level and shared.
4. Add `removeAnimation(elementId)` action that clears
   `element.animation` OR `stateOverrides[state].animation` based
   on the active state. No keyframes cleanup (see canvas preview
   notes).
5. Add `playAnimation(elementId)` action and `previewAnimation`
   store field.

**Acceptance:** patching an animation through the store writes the
right element field (base or state override depending on active
state) AND the right page-level keyframes block.

### Phase 5 — Properties panel UI

1. New `AnimationSection` component. Mount in `UiPanel` between
   `TransitionsSection` and `VisibilitySection` (motion concerns
   grouped together).
2. Build `SearchableDropdown` (or extend `EnumSelect`) for the
   preset picker.
3. Wire the property controls (Duration, Easing, Delay,
   Iteration, Direction, Fill mode, Play state) to
   `setAnimation` patches.
4. Read the resolved animation via `useResolvedElement` so the
   section automatically shows the right value at the active
   state — base value when in Default, state override when in
   Hover / Active / Focus.
5. When in a non-default state and the resolved animation comes
   from base (no state override), grey out the controls with a
   "Same as default" treatment + "Edit for this state" affordance
   that, on click, copies base into the state override and
   activates editing.
6. Inline hint when picking `infinite` iteration on a state
   animation (hover-restart behaviour).
7. Empty state, custom state, multi-animation state branches per
   "Custom / multi-animation states" above.
8. Play / Remove buttons. Remove behaviour: clears the active
   axis's animation (state override if a state is active, base
   otherwise).

**Acceptance:** clicking a preset writes the right CSS at the
active axis; tweaking properties round-trips through file edits
without losing the preset association; switching from Default to
Hover and editing puts the animation in the hover pseudo-class
block.

### Phase 6 — Canvas preview

1. `previewAnimation` reads in `ElementRenderer`; when matching,
   apply the resolved animation shorthand fresh via React `key`
   for a one-shot replay.
2. The animation Play button uses the **resolved** animation —
   base when in Default, state override when in Hover etc. So
   clicking Play in Hover mode plays the hover animation on the
   selected element.
3. Suppress looping animations on the canvas during normal editing
   (clamp `iteration` to 1 for canvas render only, regardless of
   stored value).
4. Honour `playState: 'paused'` (no preview).

**Acceptance:** clicking Play on a `pulse` preset visibly animates
the element once on the canvas; switching to Hover and clicking
Play plays the hover animation; `spin`'s infinite loop doesn't
spin forever in the editor.

### Phase 7 — Polish & docs

- `agent.md` template (both legacy and nextjs) gets a new
  "Animations" section documenting:
  - The `animation` shorthand format Scamp recognises.
  - That `@keyframes` blocks live at the bottom of the file (after
    state blocks, before `@media`).
  - That hand-written animations round-trip verbatim.
  - The list of preset names so agents can opt into them by name.
  - **State-block animations** (`.foo:hover { animation: ... }`)
    are recognised; the hover-restart caveat for infinite loops.
  - **`@media` containing animation declarations** round-trips
    verbatim but isn't editable from the panel.
- `CONTRIBUTING.md` gets a paragraph on the
  `animationPresets`-as-source-of-truth pattern AND a note that
  `StateOverride extends BreakpointOverride` to allow per-state
  animations while excluding per-breakpoint animations.
- Add a backlog entry for "Clean up unused keyframes", "Custom
  keyframes editor", "Per-breakpoint animations", and
  "`prefers-reduced-motion` wrapping" follow-ups.

---

## Files changed (anticipated)

| File | Change |
|---|---|
| `src/renderer/lib/element.ts` | Add `ElementAnimation`, `AnimationPresetName`, etc. Extend `ScampElement`. Redefine `StateOverride = BreakpointOverride & { animation? }`. Add `KeyframesBlock`. |
| `src/renderer/lib/animationPresets.ts` | NEW — curated library + canonical bodies. |
| `src/renderer/lib/parsers.ts` | Add `parseAnimationShorthand`, `formatAnimationShorthand`. |
| `src/renderer/lib/keyframesMatch.ts` | NEW — `matchesPreset`, `normaliseKeyframesBody`. |
| `src/renderer/lib/generateCode.ts` | Emit `animation` shorthand on elements; emit `pageKeyframesBlocks` between elements and media. |
| `src/renderer/lib/parseCode.ts` | Walk `@keyframes` at-rules; route `animation` declarations to typed field; add `applyDeclarationsAsStateOverride`; extend `@media` walker to dump blocks containing `animation` to `customMediaBlocks`; thread `keyframesBlocks` into `ParsedTree`. |
| `src/renderer/store/canvasSlice.ts` | `pageKeyframesBlocks`, `setAnimation`, `removeAnimation`, `playAnimation`, `previewAnimation`. |
| `src/renderer/src/syncBridge.ts` | Pass `customKeyframesBlocks` into `generateCode` call sites. |
| `src/renderer/src/components/sections/AnimationSection.tsx` | NEW |
| `src/renderer/src/components/sections/AnimationSection.module.css` | NEW |
| `src/renderer/src/components/UiPanel.tsx` | Mount the section. |
| `src/renderer/src/components/controls/SearchableDropdown.tsx` | NEW (or extend EnumSelect) |
| `src/renderer/src/canvas/ElementRenderer.tsx` | Honour `previewAnimation` (key-based remount); clamp iteration to 1 in canvas render. |
| `src/shared/agentMd.ts` | "Animations" section in both templates. |
| `test/animationPresets.test.ts` | NEW — preset library / matchesPreset tests. |
| `test/animationParser.test.ts` | NEW — `parseAnimationShorthand` / format round-trip. |
| `test/generateCodeAnimations.test.ts` | NEW — emit tests. |
| `test/parseCodeAnimations.test.ts` | NEW — parse tests. |
| `test/integration/animationRoundTrip.integration.test.ts` | NEW — full round-trip + multi-element shared keyframes + state-block animations. |

---

## Open questions (please review)

**Q1. Single animation per element vs list?**
The user story uses "an animation" (singular). My plan ships
single-animation typed picker; multi-animation source preserves
verbatim via `customProperties.animation` with a "edit in CSS mode"
panel hint. The data model doesn't need to be a list to support
this — it's enough that the multi case round-trips. Easy to extend
to a list later if users ask. Confirming the single approach is
right for the POC. Same singular-per-axis rule applies to state
animations: one animation per state.

**Q2. Auto-remove unused keyframes?**
When a user removes an animation from the last element using a
preset, do we drop the `@keyframes` block from the file? My plan:
**no, never auto-remove** — the user might re-apply, or they might
have edited the keyframes block themselves. A separate explicit
"Clean up unused keyframes" action (button at the bottom of the
panel, or under Project Settings) handles this. Simpler model;
predictable behaviour. Confirming.

**Q3. Agent-edited preset bodies?**
If the `fade-in-up` block on disk has been hand-edited away from
the canonical body, should the picker:
- **(a) Show "Custom (was fade-in-up)"** with an option to "Reset
  to canonical" — preserves the user's edit by default.
- **(b) Auto-overwrite** with the canonical body the next time the
  user picks `fade-in-up` from the dropdown.
I'd go **(a)** — destructive overwrites are rude. The user can
explicitly reset.

**Q4. Canvas-loop suppression strategy.**
Plan above clamps `iteration: 1` on the canvas rendered element
regardless of the stored value, so `spin` doesn't spin forever in
the editor. Alternative: render the iteration as the user set it
(an animated canvas is a feature, not a bug, for some workflows).
My pick: clamp + provide a "Play preview" button that does respect
the iteration count for one playthrough. Confirms the editor stays
calm by default.

**Q5. `prefers-reduced-motion` wrapping?**
Off by default; flagged as a polish follow-up. Adding it now means
the `@keyframes` blocks (or the per-element `animation`
declarations?) need to be inside a `@media (prefers-reduced-motion:
no-preference)` block, which adds parser/generator complexity for a
nice-to-have. Confirming we can defer.

**Q6. Where in the panel does Animation sit?**
My plan: between `TransitionsSection` and `VisibilitySection`, so
all motion-related controls cluster. Open to other placements.

**Q7. State animations on `:active` and `:focus` — same UX as `:hover`?**
The hover-restart hint (infinite iteration warning) applies equally
to active and focus. Plan: same inline note on all three states.
Confirming.

---

## Risks

- **`animation` shorthand parser complexity.** The CSS spec is
  permissive — name can come anywhere, iteration is a number OR
  `infinite`, two `<time>`s have positional meaning. Solid unit
  tests for every property in every position are the only way to
  build confidence. Plan allots extra time for this.
- **Keyframes-body equivalence.** "Same as canonical" is a fuzzy
  notion (whitespace, declaration order, `from` vs `0%`). The
  comparison helper needs careful tests including agent-typed
  variants the user might write naturally.
- **Preset library drift.** If we update a preset's canonical body
  in a future Scamp release, projects that already had that preset
  on disk will suddenly show as "custom." Mitigation: version the
  preset library in code; consider whether a body-mismatch should
  also check the body against any known *previous* canonical body
  before declaring it custom. Out of scope for the first ship —
  flag as a future risk.
- **Multi-animation source detection.** The parser falls back to
  `customProperties` only when it sees commas at the top level of
  the value. Agent-written nested commas inside `cubic-bezier(...)`
  must NOT trigger the fallback — the multi-animation detection has
  to walk parens depth, not just split on commas.
- **Round-trip with shared keyframes across pages.** This story is
  per-page; if two pages reference the same preset, each page emits
  its own `@keyframes` block. That's CSS-correct (each module is
  scoped) but feels duplicative if Next.js bundles them. Out of
  scope to deduplicate; flag if it bites.
- **`StateOverride` type asymmetry.** `StateOverride extends
  BreakpointOverride` keeps animations on states only at the type
  level, but most code paths treat the two as interchangeable
  (the shared `breakpointOverrideLines` emitter, the shared
  `applyDeclarationsAsOverride` parser entry point). The animation
  branch in the emitter is unreachable for actual breakpoint
  overrides, but a future refactor that swaps `StateOverride` for
  `BreakpointOverride` somewhere could silently lose the
  animation. Worth a comment at the type definition AND at the
  emit branch.
- **Canvas preview replay key.** The `key`-based remount strategy
  re-creates the entire DOM subtree of the previewed element. For
  text elements with `contentEditable` this could lose the user's
  cursor position if they're mid-edit. The Play button is gated
  behind a non-editing state in the panel anyway, but worth a
  test.
