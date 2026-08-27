# `align-items` defaulted to flex-start, but CSS defaults to stretch

Scamp's model defaulted `alignItems` to `'flex-start'`. CSS defaults it
to `stretch`. Those two facts combined into a divergence on every flex
container in every project.

## The mechanism

- `generateCode` emits `align-items` only when it differs from the model
  default — so a container left at the default writes **nothing** to the
  file, and the browser applies `stretch`.
- `elementToStyle` applies `el.alignItems` **unconditionally** — so the
  canvas applied `flex-start`.

A flex row whose children had no height was therefore full-height in the
preview and content-height on the canvas. The parity harness measured a
child at 19px on the canvas and 200px in the browser.

## The fix

Change the model default to `'stretch'` in `DEFAULT_RECT_STYLES` and
`DEFAULT_ROOT_STYLES`, rather than teaching the canvas to skip the
property. The model should describe what the file means, and a file with
no `align-items` means `stretch`.

Consequences, all of them the point:

- A file with no `align-items` now parses to `stretch` and renders
  stretched on the canvas — matching what the preview always did.
- The generator still writes nothing at the default, so no file churn.
- An explicit `align-items: flex-start` round-trips unchanged.
- The panel now shows `stretch` as the value of an unset container, which
  is the truth.

`justifyContent` needed no change: CSS also defaults it to `flex-start`,
so model and CSS already agreed.

## Why it went unnoticed

The preview was always right, and the canvas was always wrong in the same
direction — so a design built entirely on the canvas looked consistent
until it was previewed or exported. It took a harness measuring both to
surface it.

see docs/notes/parity-harness.md
