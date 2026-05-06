# Element States

Design hover, active, and focus styles directly in the [Properties Panel](properties-panel.md). Scamp writes them as `:hover`, `:active`, and `:focus` pseudo-class blocks in your CSS module — every interactive element styled visually, with no hand-written selectors.

## The State Switcher

A row of four buttons sits at the top of the properties panel whenever an element is selected:

```
[ Default ]  [ Hover ]  [ Active ]  [ Focus ]
```

Click any of them to switch the panel into that state's editing mode. The currently active state determines where your edits go:

- **Default** — top-level fields on the element. The base styles every other state cascades from.
- **Hover / Active / Focus** — a state override block. Only properties you change in this mode get written.

## Editing in a State

With Hover (or Active / Focus) selected:

- The panel renders the same controls as Default.
- Properties you've already overridden for this state show with a highlighted indicator.
- Properties that haven't been overridden show at reduced opacity with a "same as Default" treatment — you can see what's inherited at a glance.
- Edits write only the properties you change. The CSS pseudo-class block stays minimal.

To **remove** a state override for one property, right-click the field's override indicator and pick Reset — it falls back to the Default value.

## Canvas Preview

Switching states in the panel doubles as the canvas preview. With **Hover** selected, the canvas shows the selected element rendered with the hover styles applied. Switch to **Active** and you see the active styles. The canvas paints what your CSS would in a real browser.

This means designing a hover state and verifying it visually is a single workflow: click Hover, edit, see the result. No need to trigger a real DOM hover event on the canvas.

## The State Dot Indicator

Each state button (Hover, Active, Focus) shows a small dot when that state has at least one override defined. Scan the switcher to see which states are styled without clicking through them.

Removing every override from a state clears the dot — and on the next save, the matching pseudo-class block is removed from the CSS file entirely.

## What the Generated CSS Looks Like

A button with hover and active styles:

```css
.cta_c001 {
  background: #3b82f6;
  color: #ffffff;
  border-radius: 8px;
}

.cta_c001:hover {
  background: #2563eb;
  transform: translateY(-1px);
}

.cta_c001:active {
  background: #1d4ed8;
  transform: translateY(0);
}
```

Pseudo-class blocks sit directly after their base class block, grouped by element. Scamp parses both shorthand and longhand forms, so hand-written or agent-written `:hover` rules round-trip back into the panel correctly.

## Other Pseudo-Classes

Scamp models `:hover`, `:active`, and `:focus` as first-class typed states in the panel. Other pseudo-classes — `:focus-visible`, `:checked`, `:disabled`, `:nth-child(...)`, compound selectors like `.card:hover .badge` — round-trip through your CSS file unchanged but aren't editable from the State Switcher. They show up in the [CSS editor](properties-panel.md) and persist across save / reload cycles.

## Pairing With Transitions

[Transitions](transitions.md) animate the change between states. A transition declared on the Default styles (e.g. `transition: background 200ms ease, transform 200ms ease`) automatically applies when hover / active / focus take over — that's how CSS transitions work.

So the workflow is:
1. Set up your Default styles.
2. Add transition rows on Default for whatever properties will change.
3. Switch to Hover and override the changed properties.
4. The browser interpolates between Default and Hover when a real hover happens.

## Limitations

- **State + non-desktop breakpoint isn't supported.** When you switch the canvas to Mobile or Tablet, the Hover / Active / Focus buttons are disabled. Editing a state at a specific breakpoint is on the backlog.
- **No per-state animations through breakpoints.** Animations on the Default state apply at every breakpoint; per-state animations are supported, per-breakpoint per-state animations aren't.

## Tips

- Use **Focus** for keyboard accessibility — at minimum, an outline or background change. Don't just style `:hover` and call it done.
- Pair each interactive element's state styles with [Transitions](transitions.md) for a polished feel.
- See [Animations](animations.md) for keyframe-based motion, which can also be applied per state (e.g. a `shake` animation on `:hover`).
