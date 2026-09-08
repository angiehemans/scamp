# Themes: light, dark, and custom

A theme is a set of values for your semantic color tokens. Every project
starts with one theme, **Light**, and you can add **Dark** or any number
of custom themes. Each theme overrides only the semantic tokens, such as
`--color-background` or `--color-text`; your palettes and other tokens
stay shared.

You manage themes in the **Colors > Semantic** area of the
[Design System panel](design-system.md), and preview them from the
canvas toolbar.

## How themes are stored

The default (Light) theme's semantic values live in `:root`. Each
additional theme is a CSS class block—`.dark`, `.theme-<name>`—that
overrides only the tokens that differ:

```css
:root {
  --color-background: #ffffff;
  --color-text: #1e293b;
}

.dark {
  --color-background: #0f172a;
  --color-text: #f1f5f9;
}
```

## Add a theme

In the Semantic area, themes appear as stacked blocks:

- The **Light** block owns the token set. This is where you add, rename,
  and delete semantic tokens.
- Each additional theme appears as its own block below.

To create a theme, click **+ Add theme**. Scamp duplicates Light's
semantic values into a new editable block, named **Dark** first and then
**Theme 2**, **Theme 3**, and so on. Rename it inline in the block header,
and remove it with the block's **×**.

## Edit a theme's values

Edit a semantic token inside a theme's block to set that token's value
for that theme only:

- Edits in the **Light** block write to `:root`.
- Edits in a **Dark** or custom block write to that theme's class block.

If you set a token in a theme and then clear it back to match Light,
Scamp removes the now-redundant override, so the file stays clean.

## Preview a theme on the canvas

When a project has more than one theme, a theme switcher appears in the
canvas toolbar. Use it to preview any theme: the canvas re-resolves
every semantic token to the selected theme's values and repaints
immediately. This is a preview control, separate from panel editing, so
you can design against Light while you check how the design looks in
Dark.

Projects with only a Light theme don't show the switcher.

## Fonts and themes

Adding or editing a font never overwrites your theme blocks. The font
manager writes to both the base and the theme overrides safely. For the
font manager, see [Text styles](text-styles.md).

## Edit theme.css directly

Theme blocks round-trip through hand edits and AI-agent edits. Add a
`.dark { … }` block in your editor, and it loads into the panel as a Dark
theme; the panel preserves any hand-written CSS around the managed
blocks. See [Bidirectional sync](bidirectional-sync.md).
