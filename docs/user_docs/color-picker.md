# Color Picker

The color picker appears whenever you click a color swatch in the
[Properties Panel](properties-panel.md) — for background, border,
text color, or shadow color. It's a single component used everywhere
a color is editable.

## Opening the Picker

Click any color swatch button to open a popover with two tabs:
**Color** and **Tokens**.

## Color Tab

The Color tab has four areas, top to bottom:

1. **Saturation gradient** and **hue slider** — drag to choose
   saturation, brightness, and hue. The canvas previews the new
   color live as you drag.
2. **Alpha slider** — drag to set transparency. Linked to the
   opacity input below: setting the input to 50 centres the
   slider thumb, dragging the thumb updates the input.
3. **Input row**, left to right:
   - **Eyedropper button** (macOS and Windows only — see *Linux
     limitation* below) — click to activate the system eyedropper,
     then click any pixel on screen to sample its color.
   - **Hex input** — type a hex value directly (`#ff6600`).
     Three-digit shorthand expands on blur: `#fff` → `#ffffff`.
   - **Opacity input** — `0` to `100`, fixed at "%". Disabled
     when the current value is a theme token or named color
     (you can't apply a separate alpha to `var(--accent)` without
     losing the token reference; switch to a hex first to
     re-enable).
4. **Project swatches** — a single deduplicated row of every color
   used elsewhere in the project, with theme color tokens shown
   first. Click any swatch to apply it. Theme tokens apply as
   `var(--token-name)` so they keep their semantic link to
   `theme.css`.

### Alpha and Output Format

- When alpha is 1 (fully opaque), the picker writes `#rrggbb`.
- When alpha is less than 1, the picker writes
  `rgba(r, g, b, a)`.

The hex input also accepts `rgba(...)` strings directly if you
prefer typing — it round-trips whichever form you supply.

## Tokens Tab

The Tokens tab lists every color-typed theme token defined in your
project's `theme.css`. Click any token to apply it as
`var(--token-name)`.

Using tokens keeps your colors consistent across the project. Change
a token value in `theme.css` and every element referencing it
updates automatically — see [Themes](themes.md).

When a token is the currently-applied value, its row in the Tokens
tab is highlighted, and the picker's text input shows the token
name (e.g. `--accent`) instead of the raw hex.

## Eyedropper

A native screen color sampler. macOS and Windows only at the
moment.

- Click the eyedropper icon to activate.
- Your cursor changes to a crosshair with a small magnifier circle.
- Click any pixel on screen — including outside the Scamp window —
  to sample its color. The sampled color commits to the picker
  and the canvas element.
- Press **Escape** to cancel without changing the current color.

### Linux limitation

The eyedropper button is hidden on Linux. Chromium's native
EyeDropper API depends on either the Wayland `xdg-desktop-portal`
ScreenCast interface or an X11 input grab, and both paths have
known reliability issues on Ubuntu's GNOME-on-Wayland default
session. Once those upstream issues are resolved (or we ship an
in-window-only fallback) the button will return.

You can still sample colors on Linux by copying a hex value from
another app and pasting into the hex input.

## Tips

- The picker live-previews the color on the canvas while you drag
  the gradient or hue slider — no need to release the mouse to
  see the result.
- Theme tokens applied through the picker remain editable from
  the [Theme panel](themes.md) — changing the token value
  recolors every element using it.
- For shadow colors, the picker hides its own opacity input
  because the Shadow row in the [Properties Panel](properties-panel.md)
  already provides one. Use that one instead.
