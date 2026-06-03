# Themes

Scamp supports design tokens through a `theme.css` file in your
project folder. Tokens let you define reusable values — colors,
spacing scales, font sizes, line heights — and apply them across
your design from the panel's pickers.

## The theme.css File

Every project has a `theme.css` file containing CSS custom
properties:

```css
:root {
  /* colors */
  --primary: #3b82f6;
  --secondary: #64748b;
  --background: #ffffff;
  --text: #1e293b;

  /* spacing scale */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 32px;

  /* typography */
  --font-sans: "Inter", system-ui, sans-serif;
  --font-size-body: 16px;
  --line-height-body: 1.5;
}
```

A new project ships with a small starter palette plus a default
`--font-sans`. Add more tokens as your design system grows.

## Token Categories

Scamp classifies each token by its value and routes it to the
matching panel pickers. You never tag tokens by category yourself —
the value alone decides where they appear.

| Value shape | Category | Surfaces in |
|---|---|---|
| `#fff`, `rgb(…)`, `hsl(…)`, named colors | **Color** | Color Picker swatches and the Tokens tab |
| `8px`, `1rem`, `1.5em` | **Length** | Spacing / border / gap pickers, font-size, letter-spacing |
| Bare number (`1.5`, `0`) | **Number** | Line-height picker |
| Quoted font name or generic family | **Font family** | Typography section's font picker |
| Anything else | **Unknown** | Reserved — won't appear in any picker, but round-trips verbatim |

So `--space-md: 16px;` automatically shows up in every spacing
control's picker, and `--font-size-body: 16px;` shows up in the
same place (Scamp doesn't distinguish "spacing" from "font-size"
intent — they're both lengths).

## Theme Panel

Click the theme button in the toolbar to open the theme panel.
From here you can:

- **Add** new tokens with a name and value.
- **Rename** existing tokens.
- **Delete** tokens you no longer need.

Renaming or deleting a token rewrites every `var(--…)` reference
across your project files so nothing dangles.

## Using Tokens

### From the Color Picker

Open the [Color Picker](color-picker.md) on any color field and
switch to the **Tokens** tab. Click any color token to apply it.
The element's CSS becomes `color: var(--token-name)` instead of a
hardcoded value.

### From spacing fields

Padding, margin, gap, column-gap, row-gap, border-width, and
border-radius all expose a small **token icon** on the inside-right
of their input. Click it for a dropdown of every length token
declared in `theme.css`. Picking one applies the token:

- On 4-side fields (padding, margin, border-radius, border-width)
  the chosen token populates all four sides.
- On singular gap fields, the chosen token replaces the single value.

The token icon highlights in the accent color when any side of the
field currently holds a token reference, so you can see at a glance
which fields are token-bound vs literal-px.

You can still type mixed values directly (e.g. `16 var(--space-md)`)
when you want one side to use a token and others to stay px.

### From typography fields

Font-size, line-height, and letter-spacing all carry the same
token-icon picker (they've had it since the typography work — it
just got a sibling for spacing). The picker lists tokens whose
values match the field's expected shape (lengths for font-size and
letter-spacing, bare numbers for line-height).

### From the CSS editor

When editing in CSS mode in the [Properties Panel](properties-panel.md),
token names autocomplete as you type `var(--`.

### From an external editor or agent

`var(--…)` references in any CSS file round-trip through Scamp
unchanged. An AI agent writing `padding: var(--space-md);` into a
class block parses into the same typed state the panel produces —
no special syntax needed.

## Adding a Token Inline

When you click the token icon in a spacing field on a project that
has **no length tokens declared yet**, the picker shows a small
empty state with a **+ Add token** button. Click it to jump
straight to the theme panel where you can declare one. The picker
re-opens with the new token available as soon as you commit.

## Visual Resolution

On the canvas, tokens resolve to their actual values so the design
preview matches what your deployed page will look like. Change a
token's value in the theme panel and every element using it
updates immediately, both on the canvas and in the generated CSS.
