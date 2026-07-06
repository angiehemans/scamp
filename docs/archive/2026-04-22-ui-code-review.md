# UI Code Review & Cleanup — Plan

**Status:** Draft for review.
**Date:** 2026-04-22
**Scope:** `src/renderer/src/` — UI components, styles, and the CSS used to dress them. Does NOT touch store / parser / generator logic.

## Goal

The app works, but over the past two months of feature work the UI layer has accumulated:

- **35+ CSS modules** with pure hex literals. No color variable layer. Same blue appears as `#4a8cff` (26 places) and `#3b82f6` (13 places) depending on who wrote which feature first. Same gray as `#2c2c2c` in most places but `#333` / `#363636` in others.
- **3 near-identical popover implementations** (`ColorInput`, `FontPicker`, `TokenOrNumberInput`) — each with its own Escape/outside-click handler.
- **5+ inline `input` rows** with the same prefix/text/suffix pattern reinvented.
- **6 different button CSS blocks** defined across modules with no shared `<Button>` component. Two modals use different classnames (`primary` vs `confirmButton`) for the same thing.
- **A segmented-control reinvention** inline in `BackgroundSection` even though `SegmentedControl.tsx` exists.

This plan consolidates those into a theme file + a small set of shared components/hooks, without turning the UI layer into a design system project. Pragmatic, one-feature-sized cleanup.

---

## Current state — what's there today

### Colors
- **Global:** `src/renderer/src/styles/global.css` — font-face + scrollbar only. No variables.
- **Module files:** pure hex literals everywhere. Count of unique values: ~40.
- **Most-used colors** (in app chrome, not user project themes):
  - Backgrounds: `#0f0f0f` (darkest), `#1a1a1a`, `#151515`, `#1f1f1f`, `#232323`
  - Borders: `#2c2c2c` (79 uses), `#3a3a3a`, `#363636`, `#333`
  - Text: `#e0e0e0` (36), `#888` (35), `#666`, `#777`, `#555`, `#ccc`, `#fff`
  - Accents: `#4a8cff` (26), `#3b82f6` (13) — the same UI blue, different shades
  - Status: `#ef4444`, `#f59e0b`, `#10b981`
- **User-project theme** lives in `theme.css` inside each project, managed by `ThemePanel`. Totally separate concern from this refactor — don't confuse the two.

### Shared controls that already exist
- `controls/NumberInput.tsx` — number input w/ prefix
- `controls/EnumSelect.tsx` — native `<select>` wrapper
- `controls/SegmentedControl.tsx` — toggle group
- `controls/ColorInput.tsx` — color swatch + picker
- `controls/FontPicker.tsx` — font family picker
- `controls/TokenOrNumberInput.tsx` — number-or-token-reference input
- `controls/FourSideInput.tsx` — t/r/b/l quad input
- `controls/Tooltip.tsx` — portaled hover tooltip
- `controls/ToggleRow.tsx` — possibly dead; grep finds no callers

### Shared primitives that DON'T exist yet
- `<Button>` with variants (primary / secondary / destructive / ghost)
- `<PrefixSuffixInput>` (the prefix "W"/"Sz"/etc. + input + optional suffix unit)
- `usePopover()` hook (trigger ref → open + position + escape)
- `useDialogBackdrop()` hook (escape-closes modal)
- Centralized CSS variable layer

---

## Key design decisions (flag for review)

### 1. Theme file lives at `src/renderer/src/styles/theme.css`

Single file, `:root` scope, imported once from `main.tsx`. Contains ONLY app-chrome tokens — backgrounds, borders, text, accents, status, spacing, radius. Keeps the name simple.

**Naming convention** — two-part, kebab-case:
```css
:root {
  /* Backgrounds, darker → lighter */
  --bg-canvas: #0f0f0f;
  --bg-surface: #1a1a1a;
  --bg-input: #151515;
  --bg-raised: #1f1f1f;
  --bg-header: #232323;

  /* Borders */
  --border: #2c2c2c;
  --border-subtle: #232323;
  --border-strong: #3a3a3a;

  /* Text (semantic, not count-based) */
  --text-primary: #e0e0e0;
  --text-secondary: #888;
  --text-tertiary: #555;
  --text-inverse: #fff;

  /* Accents */
  --accent: #4a8cff;
  --accent-muted: rgba(74, 140, 255, 0.2);

  /* Status */
  --status-error: #ef4444;
  --status-warn: #f59e0b;
  --status-success: #10b981;

  /* Paired tones for banners */
  --info-bg: #1a2a4a;
  --info-border: #2c3a5a;
  --info-text: #dbe5ff;
  --warn-bg: #2c2618;
  --warn-text: #f5d199;
  --error-bg: #4b1d1d;
  --error-text: #fca5a5;

  /* Geometry */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;

  /* Control heights — already consistent in code, just named */
  --control-h: 24px;
  --row-h: 28px;

  /* Fonts */
  --font-ui: 'Ubuntu Mono', monospace;
}
```

**Alternative naming considered & rejected:**
- **Numeric scales** (`--gray-100`, `--gray-200`…) — too design-systemy for a codebase this size; hard to remember which is which.
- **Function** (`--panel-bg` vs `--canvas-bg`) — ambiguous for shared colors.

**Name decision for review:** semantic two-part naming above. Call it out if you'd rather do tailwind-style numeric scales.

### 2. The two accent blues collapse into one (`#4a8cff`)

`#3b82f6` shows up in 13 places — canvas selection outline, toggle-active states, a few buttons. `#4a8cff` is the "newer" blue (26 places). They read as the same color at small sizes. **Recommend collapsing to `#4a8cff` everywhere via `var(--accent)`.**

If you disagree, tell me to keep two blues and I'll name them `--accent` / `--accent-secondary`.

### 3. Out of scope: light mode

Variables are the foundation for future light-mode support, but actually doing it — designing light-mode palette, testing contrast, fixing component styles — is a separate initiative. This plan sets up the structure; it doesn't add a mode toggle.

### 4. Sidecar vs replace migration

Replace in-place: edit each `.module.css` to use `var(--…)` instead of hex literals. No parallel file, no feature flag. Low blast radius — CSS modules are scoped, and a mass find-replace is reviewable in a diff.

### 5. Out of scope: the user-facing `theme.css` panel

`ThemePanel` manages project design tokens (colors the user uses in their design). That stays untouched. Our `theme.css` is app chrome only. If you want, I can rename ours to avoid confusion (e.g. `chrome.css` or `tokens.css`), but "theme.css" in the renderer's `styles/` folder is unambiguous in practice since user `theme.css` lives in the project folder, not our source.

---

## Phased rollout

Each phase is independently reviewable and leaves the app working. Tests and typecheck must pass after each phase.

### Phase 1 — Theme variables (foundational) ✅ **Done (2026-04-22)**

1. Create `src/renderer/src/styles/theme.css` with the variable set above.
2. Import once from `src/renderer/src/main.tsx` (or wherever the entry currently imports global styles).
3. **Don't touch** any `*.module.css` yet — Phase 2 is the migration.
4. Add a brief note in `CLAUDE.md` under "Code Standards" that module CSS files should reference `var(--…)` not hex literals.

### Phase 2 — Migrate CSS modules to variables ✅ **Done (2026-04-22)**

Go file-by-file through `*.module.css` under `src/renderer/src/`. Mechanical find-replace with semantic judgment:
- `#2c2c2c` → `var(--border)`
- `#4a8cff`, `#3b82f6` → `var(--accent)`
- `#e0e0e0` → `var(--text-primary)`
- `#888`, `#777` → `var(--text-secondary)` (consolidate both to one token)
- `#666`, `#555` → `var(--text-tertiary)`
- etc.

Where a hex doesn't map cleanly, keep it literal and add a TODO — don't force every color into the system.

**Post-phase gray consolidation:** where an obvious drift exists (`#333` vs `#363636` used in 2 files vs 1), replace with the closest variable. When no variable fits and the usage is isolated, leave the literal.

### Phase 3 — `Button` component ✅ **Done (2026-04-23)**

Create `controls/Button.tsx`:

```tsx
type Props = {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  size?: 'sm' | 'md';
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
  type?: 'button' | 'submit';
};
```

Implementation:
- Primary = blue filled
- Secondary = dark filled, border
- Destructive = red filled
- Ghost = no border, no bg, hover reveals bg

Migrate:
- `ConfirmDialog.tsx` — confirm/cancel/destructive buttons
- `CreateProjectModal.tsx` — primary/secondary → match
- `ThemePanel.tsx` — add/delete buttons
- `MigrationBanner.tsx` — dismiss button
- Keep toolbar tool buttons as-is (specialized, icon-first)

Don't migrate icon-only buttons (terminal close, tab close) — those are too specialized for the generic `<Button>`.

### Phase 4 — `PrefixSuffixInput` + clean up raw inputs ✅ **Done (2026-04-23)**

Create `controls/PrefixSuffixInput.tsx` — the pattern used by `NumberInput`, `ColorInput`, `TokenOrNumberInput`, and inline in `ElementSection`. Props: `value`, `onChange`, `prefix?`, `suffix?`, `type` ('text' | 'number'), etc.

Refactor `NumberInput` to compose on top of it. `ColorInput` and `TokenOrNumberInput` also compose (they have additional popover behavior, but the text portion reuses the component).

Audit any place currently writing a raw `<input type="number|text">` inside `sections/` or `components/`. Swap for the shared component unless there's a specific reason.

### Phase 5 — `usePopover` hook ✅ **Done (2026-04-23)**

Extract the common state + behavior from `ColorInput`, `FontPicker`, `TokenOrNumberInput`:

```ts
const { open, setOpen, triggerRef, popoverRef, position } = usePopover({
  closeOnEscape: true,
  closeOnOutsideClick: true,
});
```

Migrate the three callers to use it. Each callsite drops 30–50 lines of duplicate state management.

### Phase 6 — `useDialogBackdrop` hook ✅ **Done (2026-04-23)**

Tiny — pulls out the Escape-closes-modal handler shared by `ConfirmDialog` and `CreateProjectModal`.

### Phase 7 — Standardize SegmentedControl usage ✅ **Done (2026-04-23)**

`BackgroundSection.tsx` currently reimplements a segmented-button group inline for `background-size`, `background-position`, `background-repeat`. Replace with the existing `SegmentedControl` component. Small diff, but an obvious cleanup.

### Phase 8 — Cleanup pass ✅ **Done (2026-04-23)**

- Remove `controls/ToggleRow.tsx` if grep still finds no callers (confirm first).
- Remove any now-orphan CSS rules in module files (once buttons/inputs factor out, their old classes go away).
- One README entry in `src/renderer/src/styles/README.md` describing the theme file and how to use it.

---

## File-by-file changes

| File | Phase | What |
|---|---|---|
| `src/renderer/src/styles/theme.css` | 1 | New — variable layer |
| `src/renderer/src/main.tsx` | 1 | Import `theme.css` |
| `CLAUDE.md` | 1 | Note: use `var(--…)` in module CSS |
| Every `*.module.css` under `src/renderer/src/` | 2 | Replace hex literals with `var(--…)` |
| `src/renderer/src/components/controls/Button.tsx` | 3 | New — variant-based button |
| `src/renderer/src/components/controls/Button.module.css` | 3 | New — button styles |
| `ConfirmDialog.tsx`, `CreateProjectModal.tsx`, `ThemePanel.tsx`, `MigrationBanner.tsx` | 3 | Use `<Button>` |
| `src/renderer/src/components/controls/PrefixSuffixInput.tsx` | 4 | New — shared text/number row |
| `controls/NumberInput.tsx`, `controls/ColorInput.tsx`, `controls/TokenOrNumberInput.tsx` | 4 | Compose PrefixSuffixInput |
| Any raw `<input>` callers in `sections/` and `components/` | 4 | Use PrefixSuffixInput or NumberInput |
| `src/renderer/src/hooks/usePopover.ts` | 5 | New |
| `controls/ColorInput.tsx`, `controls/FontPicker.tsx`, `controls/TokenOrNumberInput.tsx` | 5 | Replace bespoke popover logic |
| `src/renderer/src/hooks/useDialogBackdrop.ts` | 6 | New |
| `ConfirmDialog.tsx`, `CreateProjectModal.tsx` | 6 | Use hook |
| `BackgroundSection.tsx` | 7 | Use `SegmentedControl` for size/position/repeat |
| `controls/ToggleRow.*` | 8 | Remove if dead |
| `src/renderer/src/styles/README.md` | 8 | New — doc |

Rough LOC estimate: **−400 lines net** once popover + input duplication collapses. CSS diff will be larger (big find-replace) but not net additions.

---

## Risks / gotchas

1. **CSS variable fallbacks.** We're Chromium-only (Electron), so modern var() syntax works everywhere. Don't need `@supports` fallbacks.
2. **Color drift during migration.** Mapping `#888` AND `#777` both to `--text-secondary` is a small visual regression (these are slightly different shades). Acceptable for consistency; if a specific place needs the darker gray, add a `--text-secondary-strong` rather than keeping the literal.
3. **`BackgroundSection` popover-like sub-controls.** The segmented size/position/repeat controls open inline, not as a popover. Phase 7 just swaps to `SegmentedControl` — the containing behavior stays.
4. **`ColorInput` popover complexity.** The color popover has multiple panes (swatches, hex input, alpha slider) — not a simple menu. Phase 5's `usePopover` handles the open/close/position/outside-click concerns; the popover CONTENT is still ColorInput-specific.
5. **Test impact.** All renderer changes — no test changes expected. Run full suite after each phase; visual regressions (e.g. wrong gray) only show up by eye.
6. **User-facing `theme.css` confusion.** Users may see `src/renderer/src/styles/theme.css` in our source and wonder if it's related to their project theme. Recommend adding a comment at the top: "This is Scamp's APP CHROME theme. User project design tokens live in `<project>/theme.css`, managed by the Theme panel."
7. **Big diff in one PR is hard to review.** Each phase should be its own commit, ideally reviewable in isolation. Phase 2 will be the largest diff by file count; keep the semantic find-replace disciplined.

---

## Out of scope

- Light mode / theme switching.
- Redesigning controls (e.g. different button shapes).
- Moving to a UI library (Radix, Mantine, shadcn/ui).
- Restructuring the component folder layout.
- Typography scale / spacing scale variables beyond the handful listed.
- Animation / transition tokens.
- Renaming CSS modules or components.

---

## Decisions for review

1. **Theme variable naming** — semantic two-part (`--bg-surface`, `--text-secondary`) vs numeric scales (`--gray-200`). Recommend two-part.
2. **Collapse the two blues** — both `#4a8cff` and `#3b82f6` map to `--accent`. Recommend yes.
3. **File name** — `theme.css` in `styles/` (recommended) vs `chrome.css` / `tokens.css` to avoid confusion with user project themes.
4. **Light mode** — confirm out of scope.
5. **Phase ordering** — Phase 1–2 first is non-negotiable (everything else benefits from variables). 3–6 are independent and can reorder.
6. **What to skip** — no IconButton component (only 2–3 callers), no Badge component (tiny ROI). Confirm.
