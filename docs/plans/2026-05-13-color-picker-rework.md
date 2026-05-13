# Color Picker Rework — Plan

**Status:** Draft for review.
**Date:** 2026-05-13
**Source:** `docs/backlog-4.md` story #6
**Related:** Visual history panel (just shipped — provides
`beginHistoryTransaction` / `endHistoryTransaction` to coalesce
the drag's commits), Theme tokens (shipped — `tokens` prop on
ColorInput powers the existing Tokens tab), Element states
(shipped — `useResolvedElement` resolves the right scope so
preview writes need to mirror the same axis routing).

---

## Goal — two phases

Split the work into two PRs that land separately so phase 2 sits
on a known-good phase 1.

### Phase 1 — Library swap, performance fix, picker chrome rework

- Replace `react-color`'s `SketchPicker` with `react-colorful`.
- Build new picker chrome around it (hex input with shorthand
  expansion, separate opacity number input, recent colors row,
  copy-hex button).
- Wire the live-preview architecture so dragging the gradient
  updates the canvas DOM in real time at the cursor's frame
  rate. Commit to Zustand + the history slice only on pointer
  release.
- Update the four call sites (Background, Border, Shadows,
  Typography) to supply the new `onPreview` callback.

### Phase 2 — Eyedropper

- Add a native `EyeDropper` API button to the picker chrome
  built in phase 1.
- Feature-detect; hide on older Chromium.
- Sample → set the picker's current color → commit on the same
  release path phase 1 set up.

Phase 2 is small (≈30 LOC of additive work) and sits cleanly on
phase 1's foundation. Splitting them keeps each PR's review
surface tight and lets phase 1 ship even if the eyedropper
needs extra UX iteration.

---

## Current state — what we can build on

- **`ColorInput.tsx`** (`src/renderer/src/components/controls/ColorInput.tsx`).
  Wraps `react-color`'s `SketchPicker` in a popover, plus a hex
  text field with manual draft state. Renders two tabs:
  "Color" (the SketchPicker) and "Tokens" (the theme-token list).
  Public API:
  ```ts
  type Props = {
    value: string;
    onChange: (value: string) => void;
    disableAlpha?: boolean;
    presetColors?: ReadonlyArray<string>;
    tokens?: ReadonlyArray<ThemeToken>;
    onOpenTheme?: () => void;
  };
  ```
- **`react-color`** is the current library. SketchPicker bundles
  the gradient + hue slider + alpha slider + hex input + RGB/HSL
  inputs + preset swatches into one welded block. It's been
  effectively unmaintained since 2018; bundle size ~13 KB
  gzipped. Its `onChangeComplete` fires on release but its
  `onChange` fires per tick — we're using the wrong one today,
  but we're moving to a different library anyway.
- **`react-colorful`** is the target library. ~1.5 KB gzipped,
  zero dependencies, actively maintained. Its API is "just the
  picker — you build the rest":
  ```tsx
  <HexColorPicker color="#aabbcc" onChange={setLocal} />
  ```
  `onChange` fires on every drag tick by design. There's no
  separate "release" event — we detect release via pointerup on
  the popover. Alpha picker variants exist
  (`HexAlphaColorPicker`, `RgbaColorPicker`) but we'll build our
  own opacity input since the polish list asks for a separate
  numeric field anyway.
- **Call sites all look the same shape.** Background, Border,
  Shadows, Typography all do:
  ```tsx
  <ColorInput
    value={element.backgroundColor}
    onChange={(v) => patchElement(elementId, { backgroundColor: v })}
  />
  ```
  No throttling at the call site. After the refactor the public
  contract is unchanged — `onChange` still fires on commit only.
  The new `onPreview` callback is opt-in.
- **`patchElement` → `commitElementsToHistory`** writes a typed
  history entry every time. During a drag we don't want one per
  tick (we won't even produce them — the per-tick path is
  preview-only), but we still want exactly one entry per
  completed drag. The history transaction API
  (`beginHistoryTransaction` / `endHistoryTransaction`)
  composes naturally: open on first drag tick, close on
  release.
- **`syncBridge.ts`** writes to disk on a 200ms debounce
  (`WRITE_DEBOUNCE_MS`). Phase 1 keeps the disk untouched during
  the drag — no Zustand writes means no debounce wake-ups, no
  generateCode runs, no file I/O.
- **Native `EyeDropper` API** is available. Electron 31 ships
  Chromium 124 (`package.json` line 57), and `EyeDropper`
  landed in Chromium 95. No IPC plumbing needed. Phase 2 calls
  it directly from the renderer.
- **`selectProjectColors`** (`canvasSlice.ts:1559`) returns
  colors used in the project sorted by frequency. Already wired
  as the preset-swatch row via the `presetColors` prop. Recent
  colors are a separate, session-scoped concept added in phase
  1 — they sit alongside project colors, not in place of them.
- **History transaction API**
  (`useHistoryStore.beginHistoryTransaction` /
  `.endHistoryTransaction(input, snapshot)`). In production
  from the visual-history work. Drag handlers in
  `CanvasInteractionLayer.tsx` use it as the template.
- **Shadow color decomposition helpers**
  (`splitShadowColor` / `combineShadowColor` in
  `src/renderer/lib/parsers.ts`). Built for the shadow row's
  color + opacity split. The new ColorInput's separate opacity
  input reuses these exactly — same problem shape.

What's NOT there yet:

- No per-tick preview path — `onChangeComplete` is the only
  outward signal.
- No eyedropper UI or `EyeDropper` integration.
- No recent-colors store or row.
- No hex-shorthand expansion (typing `#fff` lands as `#fff` in
  the element state).
- No separate opacity input — alpha sits inside the SketchPicker
  slider only.
- No copy-on-click on the hex display.

---

## Non-goals for both phases

- **Eyedropper outside the Electron window via
  `desktopCapturer`.** Backlog spec says ship Option A (native
  `EyeDropper`) first and fall back to Option B if users
  complain. Phase 2 does A; B becomes a follow-up if needed.
- **Custom magnifier UI during the eyedrop gesture.** The native
  `EyeDropper` API ships with its own browser-supplied
  magnifier on most platforms.
- **Persisting recent colors across sessions.** Story spec says
  "current session" — in-memory only, cleared on app close.
- **Touching the canvas renderer's React tree to optimise
  rendering globally.** Phase 1's live-preview path bypasses
  Zustand and React entirely during the drag via direct DOM
  mutation. If the canvas re-renders more elements than strictly
  needed on a `patchElement` call, that's a general perf
  problem worth a separate look.
- **Multi-element color edits.** Picker is single-element. The
  multi-select-color-edit story is queued separately.
- **RGBA / HSL / HSB tabs** inside the picker. `react-color`'s
  SketchPicker had multiple input tabs; the new chrome shows
  hex + opacity only. RGB-mode editing is a follow-up if anyone
  asks (and probably not worth it — users who care can paste
  rgba strings into the hex field and the existing draft state
  handles it).

---

# Phase 1 — Library swap, perf fix, chrome rework

## Library swap rationale

`react-colorful` over `react-color`:

| Concern | react-color | react-colorful |
|---|---|---|
| Bundle (gzipped) | ~13 KB | ~1.5 KB |
| Last meaningful release | 2018 | actively maintained |
| TypeScript types | shipped, stale | first-class, current |
| Per-tick onChange | yes (`onChange`) | yes (only mode) |
| Release callback | yes (`onChangeComplete`) | no — we detect via pointerup |
| Bundled hex input / tabs / swatches | yes | no — we build them |

The "we build the chrome" point cuts both ways. With SketchPicker
we'd have to fight its built-in hex input, RGB tabs, and preset
swatches to add the new chrome (eyedropper, recent colors,
separate opacity, copy button). With react-colorful we just
*don't render* those — fewer fights with the library.

The same architecture (local state + direct DOM preview + history
transaction) would work in either library. react-colorful makes
it cleaner because its API is "fire onChange every tick" by
design instead of a quirk we have to remember to opt into.

## Performance architecture

### What's slow today

ColorInput already uses `onChangeComplete`, so per-frame Zustand
writes during the drag aren't the literal cause of lag. But the
user perception is real because **the canvas does not update
during the drag at all** — the user drags, sees the picker's
own preview move, but the canvas element they care about doesn't
reflect the new color until release.

The backlog's target behaviour is explicit:

> Dragging the gradient cursor updates the color preview at 60fps
> with no perceptible lag between cursor position and displayed
> color
>
> The canvas element's color updates in real time during the drag
>
> The file write and Zustand commit happen only on mouseup

So we need a per-tick path that updates the canvas element WITHOUT
going through Zustand on every tick. Then on release, the existing
`onChange` → `patchElement` path runs once and the canvas is back
in sync with the source of truth.

### Three layers of state

```
┌──────────────┐    onChange tick    ┌──────────────────────┐
│ HexColor-    │ ──────────────────> │ ColorInput local     │
│ Picker grid  │                     │ useState + DOM write │
└──────────────┘                     └──────────────────────┘
       │                                       │
       │ pointerup on popover                  │ direct mutation
       │ (drag release)                        ▼
       │                              ┌──────────────────────┐
       │                              │ Canvas DOM (style)   │
       │                              └──────────────────────┘
       ▼
┌──────────────┐                     ┌──────────────────────┐
│ Section's    │  patchElement       │ Zustand canvas store │
│ onChange     │ ──────────────────> │ + history commit     │
│ callback     │                     │ + 200ms file write   │
└──────────────┘                     └──────────────────────┘
```

- **Layer 1 — Local picker state** (`useState` inside ColorInput).
  Reflects the value the user is currently dragging. The
  `HexColorPicker`'s `color` prop reads from this so the picker's
  own internal preview is responsive.
- **Layer 2 — Canvas DOM preview** (direct style mutation). On
  every `onChange` tick, ColorInput writes the new value to the
  inline style of the targeted DOM node. Bypasses React entirely.
  When the next React render happens (on commit), it overwrites
  the preview with the Zustand-backed value — same color, no
  visual flicker.
- **Layer 3 — Zustand + history** (existing `onChange` callback).
  Fires once when the drag releases. Wrapped in a history
  transaction so the drag produces one entry, not zero (because
  per-tick commits are suppressed — but using the transaction is
  the consistent pattern, and composes with external-edit
  deferral cleanly).

### Detecting release without `onChangeComplete`

react-colorful doesn't fire a separate release event. We detect
the end of a drag by attaching a single window-level `pointerup`
listener while a drag is in flight:

```ts
const isDraggingRef = useRef(false);

const handlePickerChange = (next: string): void => {
  if (!isDraggingRef.current) {
    isDraggingRef.current = true;
    useHistoryStore.getState().beginHistoryTransaction();
    // Single-shot pointerup listener — fires once and tears
    // itself down. Captures the value via the ref, not the
    // closure, so a stale handler can't commit an old color.
    const handlePointerUp = (): void => {
      window.removeEventListener('pointerup', handlePointerUp);
      isDraggingRef.current = false;
      const finalValue = localRef.current;
      onChange(finalValue);
      useHistoryStore
        .getState()
        .endHistoryTransaction(
          {
            kind: 'patch',
            elementIds: historyElementId ? [historyElementId] : [],
            propertyKeys: historyPropertyKey ? [historyPropertyKey] : [],
          },
          useCanvasStore.getState().elements
        );
    };
    window.addEventListener('pointerup', handlePointerUp);
  }
  setLocal(next);
  localRef.current = next;
  onPreview?.(next);
};
```

The window listener catches release regardless of where the
pointer is when the user lets go — over the picker, off the
picker, over a different popover — and tears itself down so
there's no leak. The `localRef` mirrors the latest local state
so the deferred commit reads the freshest value (closure capture
would commit the value at drag start).

### Bridging the picker to the canvas DOM

ColorInput doesn't know which DOM element on the canvas to preview
on. The section call site does (it has `elementId` and the CSS
property name). So we add a sibling callback the section supplies:

```ts
type Props = {
  value: string;
  onChange: (value: string) => void;
  /**
   * Called on every drag tick during an active picker
   * interaction. Fires BEFORE `onChange` (which only fires on
   * release). Implementations should apply the value to the
   * canvas DOM directly — bypassing React/Zustand — so the
   * preview updates at the cursor's frame rate without paying
   * the cost of the full sync pipeline on every tick.
   *
   * When omitted, ColorInput suppresses the per-tick preview
   * entirely (legacy callers see the same release-only
   * behaviour they get today).
   */
  onPreview?: (value: string) => void;
  /** Element this picker edits — used by the history entry. */
  historyElementId?: string;
  /** Property key the entry tags — used by the panel label
   *  ("Changed background — rect_a1b2"). */
  historyPropertyKey?: keyof ScampElement;
  // ... existing props (value, onChange, disableAlpha,
  //     presetColors, tokens, onOpenTheme) ...
};
```

Call-site update for `BackgroundSection.tsx` (representative):

```tsx
<ColorInput
  value={element.backgroundColor}
  onChange={(v) => patchElement(elementId, { backgroundColor: v })}
  onPreview={previewStyle(elementId, 'backgroundColor')}
  historyElementId={elementId}
  historyPropertyKey="backgroundColor"
/>
```

Each section's `onPreview` differs by CSS property. A small helper
makes the repetition tolerable:

```ts
// src/renderer/src/components/controls/livePreview.ts

/**
 * Build an `onPreview` callback that writes `value` to the live
 * canvas DOM node's inline style. Avoids the React/Zustand
 * round-trip during a picker drag so the canvas updates at the
 * cursor's frame rate.
 *
 * The next React render — triggered by the `onChange` commit
 * on pointer release — overwrites the inline style with the
 * Zustand-backed value. Same color, no flicker.
 *
 * Returns a no-op when the element isn't currently rendered
 * (selection changed, page switched mid-drag, etc.).
 */
export const previewStyle = (
  elementId: string,
  styleProperty: keyof CSSStyleDeclaration
): ((value: string) => void) => {
  return (value: string) => {
    const node = document.querySelector<HTMLElement>(
      `[data-scamp-id="${elementId}"]`
    );
    if (!node) return;
    (node.style as unknown as Record<string, string>)[
      styleProperty as string
    ] = value;
  };
};
```

Returning a stable callback would be nicer for React (no
re-renders) but a fresh closure each render is cheap when the
deps are just primitives. If profiling shows the indirection
matters we can memoize at the call site.

### Hue and opacity inside the picker

`HexColorPicker` ships with just the gradient + hue slider (no
alpha). Alpha lives in the separate opacity number input below
the picker (see "Opacity number input" below). The local-state
+ DOM-preview pattern wraps the whole picker, so the hue slider
gets the same fluid behaviour for free. The opacity input
commits on blur (numeric), so it doesn't share the per-tick path
— it goes straight through `onChange` like any other field edit.

## Picker chrome layout

```
┌───────────────────────────────────────┐
│  [Color]  [Tokens]                    │
│  ─────────                            │
│                                       │
│   ╔══════════════════════════╗        │
│   ║                          ║        │
│   ║   HexColorPicker         ║        │
│   ║   (gradient + hue)       ║        │
│   ║                          ║        │
│   ╚══════════════════════════╝        │
│                                       │
│   ┌────────────┐ ┌───┐ ┌─┐            │
│   │ #aabbcc    │ │50%│ │📋│           │
│   └────────────┘ └───┘ └─┘            │
│                                       │
│   Recent                              │
│   ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢                     │
│                                       │
│   Project                             │
│   ▢ ▢ ▢ ▢ ▢                           │
└───────────────────────────────────────┘
```

Left-to-right on the controls row: hex input (flex: 1), opacity
input (54px), copy button.

The eyedropper button gets its own slot leftmost on this row —
but only in phase 2. Phase 1 ships the row without it.

## Hex input + shorthand expansion

The text field stays where it is. The new bits:

```ts
const expandHexShorthand = (raw: string): string => {
  const trimmed = raw.trim();
  // #rgb → #rrggbb
  const m = trimmed.match(/^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/);
  if (m) {
    const [, r, g, b] = m;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return trimmed;
};
```

Wired into the existing hex-input blur handler:

```ts
const handleHexBlur = (): void => {
  const expanded = expandHexShorthand(draft);
  if (expanded !== draft) setDraft(expanded);
  onChange(expanded);
};
```

`#FFF` → `#ffffff`. `#FfA` → `#ffffaa`. Non-shorthand input
(`#aabbcc`, `rgba(...)`, `var(--accent)`) passes through unchanged.

Unit tests in `test/colorPicker.test.ts` cover the shorthand
cases.

## Opacity number input

A second input sits next to the hex field, accepting 0–100. The
existing `splitShadowColor` / `combineShadowColor` helpers handle
the alpha-channel decomposition — same problem shape as the
shadow row.

- When the value is decomposable (hex or rgba), the field is
  editable. Edits combine the existing base hex with the new
  alpha and commit.
- When the value is a token reference (`var(--accent)`) or a CSS
  keyword (`currentColor`, `transparent`), the field is disabled.
  Hover tooltip explains why ("Opacity is disabled for token /
  named-color values. Pick a hex to enable.").

```tsx
<NumberInput
  value={alphaPercent}
  onChange={(percent) => {
    if (percent === undefined) return;
    const clamped = Math.max(0, Math.min(100, percent));
    onChange(combineShadowColor(baseHex, clamped / 100));
  }}
  min={0}
  max={100}
  suffix="%"
  disabled={!decomposable}
/>
```

The opacity input commits on blur (NumberInput's default), so it
doesn't compete with the picker drag's preview path.

## Recent colors row

### Storage

Session-only, kept in the canvas store. Not persisted, not
synced to disk.

```ts
// canvasSlice.ts — additions to CanvasState

  /**
   * Up to 8 colors the user has applied during this session,
   * most-recent first. Updated on every color-property commit.
   * Cleared on app close (not persisted).
   */
  recentColors: ReadonlyArray<string>;
  /** Push a color to the recent list — dedupes, caps at 8. */
  pushRecentColor: (color: string) => void;
```

Implementation:

```ts
pushRecentColor: (color) => {
  set((state) => {
    const filtered = state.recentColors.filter((c) => c !== color);
    const next = [color, ...filtered].slice(0, MAX_RECENT_COLORS);
    return { recentColors: next };
  });
},
```

`MAX_RECENT_COLORS = 8`. Constant near the type definition.

### Auto-population

Each section that uses ColorInput calls `pushRecentColor` alongside
the existing `patchElement` on commit:

```tsx
<ColorInput
  value={element.backgroundColor}
  onChange={(v) => {
    patchElement(elementId, { backgroundColor: v });
    pushRecentColor(v);
  }}
  onPreview={previewStyle(elementId, 'backgroundColor')}
  historyElementId={elementId}
  historyPropertyKey="backgroundColor"
/>
```

One extra line per call site. Could be hidden inside
`patchElement` by inspecting the patch for color-typed keys but
that's the canvas store inspecting its own arguments — explicit
beats clever for cross-cutting effects.

### Rendering

Row of eight 20×20 swatches below the hex/opacity row. Click →
`onChange(swatch) + pushRecentColor(swatch)`. Empty state hides
the row entirely (no row of empty boxes for fresh sessions).

## Copy hex button

Small `IconCopy` button next to the opacity input. Click:

```ts
const handleCopy = async (): Promise<void> => {
  await navigator.clipboard.writeText(value);
  setCopyFeedback(true);
  window.setTimeout(() => setCopyFeedback(false), 1200);
};
```

Button briefly swaps to a checkmark icon (or label "Copied")
while `copyFeedback` is true, then reverts. Cursor changes to
`pointer`; hover tooltip says "Copy color".

This is a separate button rather than a click-on-the-hex-label
because the hex text field stays editable — adding a copy
gesture to the input itself would compete with the edit gesture.

## Phase 1 tests

New file: `test/colorPicker.test.ts` (pure helpers, no DOM).

```ts
describe('expandHexShorthand', () => {
  it('expands #rgb to #rrggbb', () => {});
  it('expands #FFF to #ffffff (lowercases)', () => {});
  it('leaves #aabbcc unchanged', () => {});
  it('leaves rgba(...) unchanged', () => {});
  it('leaves var(--accent) unchanged', () => {});
});

describe('canvasSlice — recentColors', () => {
  it('pushes a new color to the head', () => {});
  it('dedupes — pushing an existing color moves it to head', () => {});
  it('caps at MAX_RECENT_COLORS', () => {});
  it('preserves case as written', () => {});
});
```

Hand-tested in `npm run dev`:

- Drag the gradient: canvas element updates in real time, no
  history spam, one entry on release.
- Drag the hue slider: same behaviour.
- Type `#fff` in the hex field + blur: value becomes `#ffffff`,
  commits.
- Type `50` in the opacity field: alpha channel updates, commits
  via `combineShadowColor`.
- Click the copy button: clipboard contains the hex, button
  briefly shows feedback.
- Pick a few colors; recent row populates, click an old swatch,
  it re-applies.

## Phase 1 implementation order

1. **Install `react-colorful`.** `npm install react-colorful`.
   Remove `react-color` from `package.json` (no other consumers).

2. **`recentColors` slice.** Add `recentColors` field +
   `pushRecentColor` action to `canvasSlice.ts`. Unit tests
   in a new `test/recentColors.test.ts` (or extend an existing
   canvasSlice test file).

3. **`expandHexShorthand` helper.** Pure function + unit tests
   in `src/renderer/src/components/controls/colorUtils.ts`.

4. **`livePreview` helper.** `previewStyle(elementId,
   styleProperty)` in
   `src/renderer/src/components/controls/livePreview.ts`.

5. **ColorInput rebuild.**
   - Swap `SketchPicker` for `react-colorful`'s
     `HexColorPicker`.
   - Add internal `useState` for local drag value.
   - Add the window-level pointerup detection for release.
   - Wire `beginHistoryTransaction` /
     `endHistoryTransaction` around the drag.
   - Accept new optional props: `onPreview`,
     `historyElementId`, `historyPropertyKey`.
   - Build the new chrome row: hex input (with shorthand on
     blur) + opacity NumberInput + copy button.
   - Render the recent colors row (hidden when empty).
   - Keep the Tokens tab unchanged.
   - Hand-test the drag-doesn't-spam-history behaviour and
     visual fluidity in `npm run dev`.

6. **Wire `onPreview` + `historyElementId` /
   `historyPropertyKey` + `pushRecentColor`** into the four
   call sites:
   - BackgroundSection.tsx
   - BorderSection.tsx
   - ShadowsSection.tsx (within `ShadowColorRow`)
   - TypographySection.tsx
   Hand-test each picker still works end-to-end.

7. **Polish + visual styling.** Tooltips on each control. Make
   sure the popover layout still fits at narrow widths. Update
   the existing `ColorInput.module.css` to absorb any layout
   change from dropping SketchPicker's built-in chrome.

8. **Docs.** Update `agent.md` to note that recent colors are
   session-only (so an agent reading state doesn't get confused
   if they query for them).

---

# Phase 2 — Eyedropper

## EyeDropper API integration

Native Chromium API, available since Chromium 95. Electron 31
ships Chromium 124, so we're well above the floor.

```ts
type EyeDropperApi = {
  open: () => Promise<{ sRGBHex: string }>;
};
type EyeDropperWindow = {
  EyeDropper?: new () => EyeDropperApi;
};

const isEyeDropperSupported = (): boolean =>
  typeof (window as unknown as EyeDropperWindow).EyeDropper === 'function';

const handleEyedropperClick = async (): Promise<void> => {
  const ctor = (window as unknown as EyeDropperWindow).EyeDropper;
  if (!ctor) return;
  const dropper = new ctor();
  try {
    const result = await dropper.open();
    const sampled = result.sRGBHex; // '#aabbcc'
    setLocal(sampled);
    onPreview?.(sampled);
    onChange(sampled);
    pushRecentColor(sampled);
  } catch {
    // User pressed Escape. No-op.
  }
};
```

## Button placement

Add the button to the controls row built in phase 1. Layout
becomes:

```
┌────┐ ┌────────────┐ ┌───┐ ┌─┐
│ 💧 │ │ #aabbcc    │ │50%│ │📋│
└────┘ └────────────┘ └───┘ └─┘
```

The 💧 represents the `IconColorPicker` from
`@tabler/icons-react` (or `IconPipette`, whichever reads better
— pick during implementation).

Hidden when `isEyeDropperSupported()` returns false — no broken
button on older Chromium.

## Cursor / magnifier

Browser-supplied. The native eyedropper on macOS and Windows
shows a circular magnifier with a crosshair. We don't render
anything custom.

## Escape handling

The native API closes itself on Escape — no extra wiring. We
catch the rejection from `dropper.open()` and discard.

## Recent colors interaction

The sampled color flows through the same commit path the
gradient drag uses: local state → `onChange` → `pushRecentColor`.
So an eyedrop sample naturally lands in the recent-colors row,
matching the spec.

## Phase 2 tests

Hand-tested:

- Open the popover, click the eyedropper, click anywhere in
  the Scamp window: sampled color appears in the picker,
  commits, lands in recent.
- Eyedropper + Escape: picker stays at the original color, no
  recent-colors mutation.
- (Platform-dependent) Try sampling outside the Scamp window
  on Mac, Windows, Linux. Document the per-platform behaviour
  in `agent.md` or a follow-up note. If out-of-window sampling
  fails on a primary platform, that's signal for an
  Option B follow-up.

## Phase 2 implementation order

1. **Add `IconColorPicker` import** (or whichever Tabler icon
   we pick).

2. **`isEyeDropperSupported` + `handleEyedropperClick`** in
   ColorInput. Feature-detect, hide button when unsupported.

3. **Render the button** in the controls row leftmost.

4. **Hand-test** on each available platform. If a platform's
   eyedropper is unreliable, decide whether to ship Option B
   (`desktopCapturer` overlay) or hide the button per-platform.

5. **Update `agent.md`** to note the eyedropper exists. Mention
   the in-window-vs-out-of-window caveat per platform if any
   were found unreliable.

---

## Risks and edge cases

### Phase 1

- **DOM lookup misses during page switch.** If the user starts
  dragging the picker, switches pages mid-drag (Cmd+Tab away,
  back, click another page), the `[data-scamp-id="..."]` node
  may not exist anymore. `previewStyle` returns a no-op when
  the node is gone — safe, just visually un-responsive for the
  rest of that drag. The `onChange` commit still lands in
  Zustand (which targets the canvas store regardless of which
  page is displayed). User is on a different page so the result
  is invisible until they switch back. Not ideal but rare;
  document in a code comment.
- **`!important` styles from custom CSS overriding the preview.**
  The canvas renderer applies inline styles for typed fields.
  `customProperties` for non-modelled fields may use
  `!important`. Our direct-DOM preview writes inline, which
  beats `!important` rules at the same specificity unless the
  rule ALSO uses `!important` on a more specific selector.
  Should Just Work for the typical case; hand-test on an
  element with heavy `customProperties`.
- **Two pickers open at once.** Theoretically possible if the
  user opens the popover for one property while another popover
  is still mounted. The local-state-during-drag pattern is
  per-instance, so two pickers don't conflict with each other
  on local state — they each preview their own property. The
  history transaction is global, though: both pickers calling
  `beginHistoryTransaction` would nest, and only the outermost
  end commits. Practical impact: rare; if it happens both
  drags' final values land in one entry. Acceptable.
- **`onPreview` writing to a stale DOM node.** If the canvas
  re-renders during the drag (some other state change unrelated
  to the picker), React will replace the inline style we wrote.
  The next picker tick re-writes it, so visually one-frame
  flicker at most. The drag itself doesn't trigger any Zustand
  updates that would cause this — but background events (theme
  tokens loading, font loading, external file edit) could.
  Worth a hand-test.
- **react-colorful's color string format.** `HexColorPicker`
  emits `#rrggbb` strings — no rgba support natively. We feed
  it the hex portion (extracted via `splitShadowColor`) and
  combine with the opacity input's alpha externally. Means
  the picker itself never sees the alpha component, but the
  user-facing semantics (drag the gradient → color updates,
  drag the opacity input → alpha updates) match what they
  expect. Worth a hand-test on an `rgba(...)` starting value
  to confirm the round-trip.
- **`expandHexShorthand` and `disableAlpha`.** The Shadows row
  uses `disableAlpha` (alpha lives in a sibling NumberInput in
  the row itself, NOT inside ColorInput). Expansion should
  preserve the separation — `#fff` → `#ffffff` AND row-level
  alpha stays at whatever it was. The helper just expands
  shorthand; combining with alpha is the caller's
  responsibility (and the existing shadow code already does
  that combination). Verify the row still works after the
  rebuild.
- **Window-level pointerup leak.** If a component unmounts
  mid-drag (popover closes, page reloads), the `pointerup`
  listener is still attached. Mitigation: on unmount, also
  remove the listener if `isDraggingRef.current` is still
  true. Small cleanup in a `useEffect` return.

### Phase 2

- **Eyedropper not available.** On rare older Chromium
  versions the API isn't there. We feature-detect; the button
  is hidden when the API is missing. No degraded fallback —
  users on old Electron just don't see the affordance.
- **Eyedropper permission prompts (Linux/Wayland).** Some
  Linux environments may surface a permission prompt when
  calling `EyeDropper.open()`. The API handles it; we don't
  need extra IPC. Test on Linux before shipping if Linux is a
  supported platform.
- **Out-of-window sampling unreliable.** Backlog already calls
  this out — Option A may not work cross-platform for
  out-of-window pixels. We ship A; if it breaks for a
  significant cohort, Option B (`desktopCapturer` overlay) is
  the follow-up.

---

## Open questions for review

1. **`onPreview` as a prop or via a shared context?** My plan
   adds it as an explicit prop on every call site. Alternative:
   a single `<CanvasPreviewProvider>` in `ProjectShell.tsx`
   whose context exposes `preview(elementId, prop, value)`, and
   ColorInput uses it implicitly. Recommend **prop** — explicit
   beats magic for something hot-path. Confirm. agreed.

2. **Recent colors scope.** Per-session, in-memory only —
   confirmed by the backlog spec. Per-project or global across
   the app? My take: **global** (session-scoped, not
   project-scoped). Switching projects doesn't clear the recent
   list. Confirm. no this is just per project, what colors are currently used in this project, show them here.

3. **History entry kind for picker drag.** A drag commits one
   `patch` entry with `propertyKeys: ['backgroundColor']` (or
   whichever). The label reads "Changed background — rect_a1b2".
   Confirm that's the right read — alternative is a dedicated
   `color-picker` kind, but that splits the namespace
   needlessly. agreed.

4. **`onChange` firing only when `onPreview` is provided.** With
   the new design, if a caller doesn't supply `onPreview` they
   get a release-only `onChange` (same as today). Confirm —
   alternative is requiring `onPreview` on all call sites and
   accepting a no-op when none of the legacy-style preview is
   needed. agreed.

5. **Eyedropper out-of-window.** Phase 2 ships Option A (native
   EyeDropper) per backlog. Option B (`desktopCapturer`
   overlay) becomes a follow-up only if users report the
   in-window limitation. Confirm. agreed.

6. **Copy-hex behavior on `var(--accent)` token values.** When
   the value is a token reference, the displayed text is the
   token string. Copy button should:
   - Copy the literal `var(--accent)` string (recommended —
     matches what's stored)
   - Copy the resolved color (more useful if pasting into a
     different tool)
   - Be hidden for token values (safest)

   Recommendation: copy the literal string. Confirm. agreed.

7. **`react-colorful` opacity picker.** The library exposes
   `HexAlphaColorPicker` and `RgbaColorPicker` that include a
   built-in alpha slider. My plan uses plain `HexColorPicker`
   plus a separate numeric opacity input next to the hex.
   Alternative: use `HexAlphaColorPicker` AND a sibling number
   input, both bound to the same alpha. Recommendation: plain
   `HexColorPicker` only — single source of truth, fewer
   sliders, matches the "polish quartet" spec. Confirm. I want the ui to show the hex and the opcity fields below the color picker ui that has the color and the alpa sliders.
   
