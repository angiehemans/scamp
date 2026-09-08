# Element states

Design hover, active, and focus styles directly in the
[properties panel](properties-panel.md). Scamp writes them as `:hover`,
`:active`, and `:focus` pseudo-class blocks in your CSS module, so every
interactive element is styled visually, with no hand-written selectors.

## The state switcher

A row of four buttons sits at the top of the properties panel whenever
an element is selected:

```
[ Default ]  [ Hover ]  [ Active ]  [ Focus ]
```

Click a button to switch the panel into that state's editing mode. The
active state determines where your edits go:

- **Default**: The top-level fields on the element—the base styles that
  every other state cascades from.
- **Hover**, **Active**, and **Focus**: A state override block. Only the
  properties you change in this mode are written.

## Edit in a state

With **Hover** (or **Active** or **Focus**) selected:

- The panel shows the same controls as Default.
- Properties you've already overridden for this state show a highlighted
  indicator.
- Properties that aren't overridden appear at reduced opacity, so you
  can see at a glance what's inherited from Default.
- Edits write only the properties you change. The CSS pseudo-class block
  stays minimal.

To remove a state override for one property, right-click the field's
override indicator and select **Reset**. The property falls back to the
Default value.

## Canvas preview

Switching states in the panel also previews them on the canvas. With
**Hover** selected, the canvas shows the selected element with its hover
styles applied. Switch to **Active**, and you see the active styles. The
canvas paints what your CSS would paint in a real browser.

Designing a hover state and checking it visually is therefore a single
workflow: click **Hover**, edit, and see the result. You don't need to
trigger a real hover on the canvas.

## The state dot indicator

Each state button shows a small dot when that state has at least one
override. Scan the switcher to see which states are styled without
clicking through them.

Removing every override from a state clears the dot, and on the next
save, Scamp removes the matching pseudo-class block from the CSS file.

## The generated CSS

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

Pseudo-class blocks sit directly after their base class block, grouped
by element. Scamp parses both shorthand and longhand forms, so
hand-written or agent-written `:hover` rules round-trip back into the
panel.

## Other pseudo-classes

Scamp models `:hover`, `:active`, and `:focus` as typed states in the
panel. Other pseudo-classes—`:focus-visible`, `:checked`, `:disabled`,
`:nth-child(...)`, and compound selectors like `.card:hover .badge`—
round-trip through your CSS file unchanged, but you can't edit them from
the state switcher. They appear in the [CSS editor](properties-panel.md)
and persist across saves and reloads.

## Pair states with transitions

[Transitions](transitions.md) animate the change between states. A
transition declared on the Default styles—for example,
`transition: background 200ms ease, transform 200ms ease`—applies
automatically when hover, active, or focus takes over. That's how CSS
transitions work.

The workflow:

1. Set up your Default styles.
2. On Default, add transition rows for the properties that change.
3. Switch to **Hover** and override the properties that change.
4. The browser interpolates between Default and Hover when a real hover
   happens.

## Limitations

- **States at non-desktop breakpoints aren't supported.** When you
  switch the canvas to Mobile or Tablet, the **Hover**, **Active**, and
  **Focus** buttons are disabled. Editing a state at a specific
  breakpoint is on the backlog.
- **No per-state animations across breakpoints.** Animations on the
  Default state apply at every breakpoint. Per-state animations are
  supported; per-breakpoint per-state animations aren't.

## Tips

- Use **Focus** for keyboard accessibility—at minimum, an outline or a
  background change. Don't style only `:hover`.
- Pair each interactive element's state styles with
  [transitions](transitions.md) for a polished feel.
- For keyframe-based motion, which you can also apply per state (for
  example, a `shake` animation on `:hover`), see
  [Animations](animations.md).
