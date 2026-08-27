# Gradients rendered in the preview but not on the canvas

The generator and the canvas put a `background` value on two different
CSS properties, and only one of them accepts a gradient.

| | property written | takes a gradient? |
|---|---|---|
| `generateCode` | `background: <value>` (shorthand) | yes |
| `elementToStyle` | `background-color: <value>` (longhand) | **no** |

`background-color: radial-gradient(…)` is invalid, so the browser drops
the declaration without a warning. The element painted nothing on the
canvas while the preview showed the gradient.

This affected every non-colour background — linear, radial and conic
gradients, `repeating-*`, and `url()` images — not just the radial one it
was found with (the `design-podcast` hero glow).

## Why the canvas uses longhands at all

Deliberately: a `background-image` or `background-size` arriving through
`customProperties` would be wiped by a competing `background` shorthand in
the same inline style, and React warns about mixing the two.

So the fix keeps longhands and picks the right one, rather than switching
to the shorthand:

- colour → `background-color`
- gradient / `url()` → `background-image`
- a positioned value the longhands can't express (`url(x) center / cover`,
  anything with a repeat or box keyword) → `background` shorthand, since
  no single longhand holds it

`classifyBackgroundValue` in `src/renderer/lib/backgroundValue.ts` makes
that call. It ignores `/` inside parentheses, so `rgb(0 0 0 / 50%)` stays
a colour rather than being mistaken for a positioned shorthand.

## Token resolution differs per branch

Colours resolve through the colour chain, where an unknown token becomes
the `transparent` sentinel the panel relies on. Gradients resolve through
the non-colour chain, which keeps the raw value when a token is missing —
blanking an entire gradient because one stop referenced a missing token
would be worse than leaving it as written.

## Related

Another instance of the canvas re-deriving what the generator already
wrote; see the parity plan for why that keeps producing this class of
defect.
