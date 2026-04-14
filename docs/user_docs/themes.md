# Themes

Scamp supports design tokens through a `theme.css` file in your project folder. Tokens let you define reusable colors and apply them across your design.

## The theme.css File

Every project has a `theme.css` file containing CSS custom properties:

```css
:root {
  --primary: #3b82f6;
  --secondary: #64748b;
  --background: #ffffff;
  --text: #1e293b;
}
```

Existing projects get a `theme.css` file automatically when opened if one does not already exist. New projects start with a default starter palette.

## Theme Panel

Click the theme button in the toolbar to open the theme panel. From here you can:

- **Add** new tokens with a name and color value.
- **Rename** existing tokens.
- **Delete** tokens you no longer need.

## Using Tokens

### In the Color Picker

Open the [Color Picker](color-picker.md) and switch to the **Tokens** tab. Click any token to apply it. The element's CSS will use `var(--token-name)` instead of a hardcoded color.

### In the CSS Editor

When editing in CSS mode in the [Properties Panel](properties-panel.md), token names autocomplete as you type `var(--`.

## Visual Resolution

On the canvas, tokens resolve to their actual color values so you see the real appearance of your design. Change a token's value in the theme panel and every element using it updates immediately.
