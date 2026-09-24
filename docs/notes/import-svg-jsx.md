# What an agent had to clean up, and what the importer does now

A real import was handed to an agent to tidy. Its report named the
things it had to fix by hand; each was checked against the generated
files before anything was changed here, because a report is a claim,
not a measurement. The counts below are from the actual import of
`dev.resovaiq.com`.

## Verified, and fixed

**SVG markup React refuses — 30 `style="…"` strings, 5 `stop-color`,
1 `fill-rule`.** `svgSource` is the DOM's own serialisation of an icon's
innards, emitted verbatim into a `.tsx` file. The DOM writes HTML:
`style` is a string and presentation attributes keep their hyphens.
React takes neither.

This is also why the icons rendered black. `style="fill: currentcolor"`
was captured *correctly* — and then dropped by the renderer, because a
string `style` is not something React applies. One conversion fixes the
compile error and the colour together.

`svgJsx.ts` converts on the way in, not in the generator: a hand-written
`<svg>` already contains JSX and must be emitted byte-for-byte, which is
what `svgSource` promises. The converter is idempotent, because the
source round-trips through `parseCode` and is converted again on every
save.

**834 single-side declarations, and an 87KB stylesheet.**
`getComputedStyle` only ever reports longhands, so a capture carries
`padding-top` … `padding-left` and never `padding`. Scamp maps the
*shorthand* to its typed field and has no mapper for the sides, so all
four fell through to `customProperties`: four lines where one would do,
and none of them editable in the properties panel.

`foldShorthands` folds a complete set into the shorthand — padding,
margin, border width/style/colour, and the radius corners. Only when all
four are present: a partial set is a value the page set on one edge, and
writing a shorthand would invent the other three. On the same page the
count went 66 → 6, and the six that remain are genuinely partial.

**Links pointed back at the site.** `href` was resolved absolute like
`src`, so every nav item walked the user out of the project and onto
`https://dev.resovaiq.com/…`. A link to the same origin now keeps its
path; a link to another site stays absolute, because that one really is
external. `src` is unchanged — the downloader needs somewhere to fetch
from.

**`datetime` is not a JSX attribute.** Kept attributes are now spelled
the way React spells them, the same conversion the SVG markup gets.

## Still open, and why they are listed here

The report named more than this. Left for now, in rough order of what
they would cost:

- **The page's own design tokens.** The original defines its palette in
  `:root`; the capture reads computed values, so every use arrives as a
  resolved colour and the token itself is lost. `extractTokens` then
  invents `--color-1` … `--color-13` from the values. Reading the
  page's custom properties — now that the original CSS is kept beside
  the view — would give real names instead.
- **Duplicate tokens on re-import.** A second import into the same
  project wrote `--color-N-imported` next to the `--color-N` it had
  written before.
- **Gradient text arrives half-imported.** 82 `color: transparent`
  declarations and no `background-clip`, so the text is invisible
  rather than gradient-filled. Either capture the idiom whole or refuse
  a transparent colour with nothing painting behind it.
- **Wrapper spans and empty boxes.** ~25 wrappers, an empty `<section>`,
  and two zero-size `<svg>`s holding only gradient definitions. The
  collapse pass only removes single-child `<div>`s.
- **Generic names.** `box_0090`, `label_00a5`. The page's own class
  names are right there in the capture.
- **`scamp_check_view` returned a stale report** after the file
  changed — reported, not yet investigated.
