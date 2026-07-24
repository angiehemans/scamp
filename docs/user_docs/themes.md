# Themes — Light, Dark & Custom

A **theme** is a set of values for your semantic color tokens. Every
project starts with one theme — **Light** — and you can add **Dark** or
any number of custom themes. Each theme only overrides the *semantic*
tokens (like `--color-background` or `--color-text`); your palettes and
other tokens stay shared.

Themes are managed in the **Colors → Semantic** area of the
[Design System panel](design-system.md), and previewed from the canvas
toolbar.

## How Themes Are Stored

The default (Light) theme's semantic values live in `:root`. Each
additional theme is a CSS class block — `.dark`, `.theme-<name>` — that
overrides just the tokens that differ:

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

## Adding a Theme

In the Semantic area, themes render as **stacked blocks**:

- The **Light block** owns the token set — this is where you add,
  rename, and delete semantic tokens.
- Each additional theme appears as its own block below.

Click **+ Add theme** to create one. It duplicates Light's semantic
values into a new editable block (auto-named **Dark**, then **Theme 2**,
**Theme 3**, …). Rename it inline in the block header, and remove it with
the block's **×**.

## Editing a Theme's Values

Edit a semantic token inside a theme's block to set that token's value
*for that theme only*:

- Edits in the **Light block** write to `:root`.
- Edits in a **Dark or custom block** write to that theme's class block.

If you set a token in a theme and then clear it back to matching Light,
Scamp prunes the now-redundant override so the file stays clean.

## Previewing on the Canvas

When a project has more than one theme, a **theme switcher** appears in
the canvas toolbar. Use it to preview any theme — the canvas re-resolves
every semantic token to the selected theme's values and repaints
instantly. This is a preview control, separate from panel editing, so you
can design against Light while checking how it looks in Dark.

Light-only projects don't show the switcher.

## Fonts and Themes

Adding or editing a font never clobbers your theme blocks — the font
manager writes to both the base and the theme overrides safely. See
[Text Styles](text-styles.md) for the font manager.

## Editing theme.css Directly

Theme blocks round-trip through hand edits and AI-agent edits. Add a
`.dark { … }` block in your editor and it loads into the panel as a Dark
theme; the panel preserves any hand-written CSS around the managed
blocks. See [Bidirectional Sync](bidirectional-sync.md).
