# Color picker

The color picker appears whenever you click a color swatch in the
[properties panel](properties-panel.md)—for background, border, text
color, or shadow color. It's one component, used everywhere a color is
editable.

## Open the picker

Click any color swatch to open a popover with two tabs: **Color** and
**Tokens**.

## The Color tab

The Color tab has four areas, from top to bottom:

1. **Saturation gradient and hue slider**: Drag to choose saturation,
   brightness, and hue. The canvas previews the new color as you drag.
2. **Alpha slider**: Drag to set transparency. It's linked to the opacity
   input below: setting the input to 50 centers the slider thumb, and
   dragging the thumb updates the input.
3. **Input row**, from left to right:
   - **Eyedropper button** (macOS and Windows only; see
     [Linux limitation](#linux-limitation)): Click it to activate the
     system eyedropper, and then click any pixel on screen to sample its
     color.
   - **Hex input**: Type a hex value directly, such as `#ff6600`.
     Three-digit shorthand expands when the field loses focus: `#fff`
     becomes `#ffffff`.
   - **Opacity input**: `0` to `100`, fixed at `%`. It's disabled when
     the current value is a theme token or a named color, because you
     can't apply a separate alpha to `var(--accent)` without losing the
     token reference. Switch to a hex value first to re-enable it.
4. **Project swatches**: A single deduplicated row of every color used
   elsewhere in the project, with theme color tokens first. Click a
   swatch to apply it. Theme tokens apply as `var(--token-name)`, so they
   keep their semantic link to `theme.css`.

### Alpha and output format

- When alpha is 1 (fully opaque), the picker writes `#rrggbb`.
- When alpha is less than 1, the picker writes `rgba(r, g, b, a)`.

The hex input also accepts `rgba(...)` strings if you prefer to type
them; it round-trips whichever form you supply.

## The Tokens tab

The Tokens tab lists every color-typed theme token defined in your
project's `theme.css`. Click a token to apply it as `var(--token-name)`.

Tokens keep your colors consistent across the project. Change a token
value in `theme.css`, and every element that references it updates
automatically. See [Themes](themes.md).

When a token is the currently applied value, its row in the Tokens tab
is highlighted, and the picker's text input shows the token name, such
as `--accent`, instead of the raw hex value.

## Eyedropper

The eyedropper is a native screen color sampler, available on macOS and
Windows.

1. Click the eyedropper icon. Your pointer changes to a crosshair with a
   small magnifier circle.
2. Click any pixel on screen, including outside the Scamp window, to
   sample its color. The sampled color commits to the picker and the
   canvas element.

To cancel without changing the current color, press **Escape**.

### Linux limitation

The eyedropper button is hidden on Linux. Chromium's native EyeDropper
API depends on either the Wayland `xdg-desktop-portal` ScreenCast
interface or an X11 input grab, and both paths have known reliability
issues on Ubuntu's default GNOME-on-Wayland session. The button returns
when those upstream issues are resolved, or when Scamp ships an
in-window-only fallback.

You can still sample colors on Linux by copying a hex value from another
app and pasting it into the hex input.

## Tips

- The picker previews the color on the canvas while you drag the
  gradient or hue slider; you don't need to release the mouse to see the
  result.
- Theme tokens applied through the picker remain editable from the
  [Design System panel](themes.md). Changing the token value recolors
  every element that uses it.
- For shadow colors, the picker hides its own opacity input, because the
  Shadow row in the [properties panel](properties-panel.md) already
  provides one. Use that one instead.
