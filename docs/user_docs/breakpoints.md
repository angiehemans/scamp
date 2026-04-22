# Breakpoints

Design for multiple screen sizes without writing media queries by hand. Scamp's breakpoint system lets you switch the canvas to Mobile, Tablet, or Desktop and make style edits that land inside the correct `@media (max-width: Npx)` block.

## The Default Breakpoints

Every project starts with three breakpoints:

| Name | Width |
|---|---|
| Desktop | 1440px |
| Tablet | 768px |
| Mobile | 390px |

These map directly to `@media (max-width: …)` queries in your exported CSS. You can edit them or add custom breakpoints — see [Settings](settings.md).

## Switching Breakpoints

The canvas-size control above the canvas shows the currently active breakpoint (e.g. `Tablet · 768`). Click to open the popover, then pick a breakpoint. The canvas resizes AND edits from here on go to that breakpoint's override.

You can also type a custom width in the popover. Custom widths drop the active breakpoint back to Desktop — use them to preview a specific size without committing to a breakpoint override.

## Editing at a Breakpoint

With a non-desktop breakpoint active, every edit routes to that breakpoint's override:

- Changing padding, background, position, size — lands in `@media (max-width: Npx)`.
- Dragging or resizing — also lands at the breakpoint. The base desktop position is preserved.
- Changing a tag, text content, or name — always lands at the base (these aren't breakpoint-specific).

The canvas renders with the cascaded styles at the active breakpoint, so what you see is what the exported page will look like at that width.

## The Override Indicator

Each section in the properties panel shows a small **blue dot** next to its title when the active breakpoint has any overrides within that section. Hover the dot to see a tooltip listing every overridden CSS property — e.g. `padding, background, border-color`. **Right-click** the dot to reset every overridden field in the section at once; each one drops back to its cascade value.

"Cascaded" means Scamp walks from the widest applicable breakpoint down to the active one. At Mobile (390), Tablet's override (768) also applies — because `max-width: 768` matches mobile too. Mobile's override wins when both set the same field, matching real CSS cascade behavior.

## What the CSS Looks Like

A page with a tablet override and a mobile override emits:

```css
.rect_a1b2 {
  width: 100%;
  padding: 24px;
}

@media (max-width: 768px) {
  .rect_a1b2 {
    padding: 12px;
  }
}

@media (max-width: 390px) {
  .rect_a1b2 {
    padding: 8px;
  }
}
```

- Base styles on the class itself.
- `@media` blocks grouped by breakpoint, widest first, at the bottom of the file.
- Only overridden properties appear in each `@media` block — everything else cascades.

## Raw CSS Editor at a Breakpoint

Switch the properties panel to CSS mode while a non-desktop breakpoint is active and the editor shows only that breakpoint's declarations. Commits write to the `@media` block, not the base class.

## External Edits

Edit `@media (max-width: …)` blocks by hand or with an AI agent — Scamp reads them back on file change and routes declarations to the right breakpoint. Unknown queries (`min-width`, `prefers-color-scheme`, custom widths outside the project's breakpoint list) are preserved verbatim but not reflected on the canvas.

See [Bidirectional Sync](bidirectional-sync.md).

## Custom Breakpoints

Add breakpoints in **Settings → Breakpoints**. Each breakpoint needs:

- A **label** (e.g. `Wide`).
- A **width** in pixels — the `max-width` value that lands in your CSS.

Scamp keeps breakpoints sorted widest-first so the generated `@media` cascade stays predictable.

You can delete any breakpoint except Desktop — it's the base and can't be removed.

## Limitations

- **Only `max-width` queries are supported.** `min-width`, `prefers-color-scheme`, and `orientation` queries round-trip untouched but don't show up on the canvas.
- **Pixel values only.** `max-width: 48rem` won't match — use `768px`.
- **No tag / text / content per breakpoint.** Only CSS-level properties can vary. Changing a tag or editing text content always writes to the base.

## Tips

- Start at Desktop, build the base layout, then switch to Tablet or Mobile and tweak only what needs to change.
- Use the override dot to scan the panel and see exactly which properties have been customised at the current breakpoint.
- If your project's CSS already uses `@media (max-width: 768px)` from before Scamp, your overrides will pick up automatically as long as the width matches a defined breakpoint.
