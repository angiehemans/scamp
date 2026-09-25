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

Most of that report has since been dealt with — gradient text, wrapper
spans, element names and the stale `scamp_check_view` each have their
own section in `import-naming.md`. What is left:

- **Empty boxes survive the collapse.** An empty `<section>`, and a
  zero-size `<svg>` holding nothing but gradient `<defs>`. The collapse
  pass removes a wrapper with exactly one child; neither of these has
  any.
- **The page's own design tokens are deliberately NOT imported.** The
  original defines its palette in `:root` and the capture reads
  computed values, so every use arrives as a resolved colour. Reading
  those custom properties would remove the last of the theme work — and
  it is a decision the user should make rather than the importer: which
  values become theme tokens and which stay literals is design, not
  translation.

## Importing the same site twice

Two things duplicated themselves on a second import, both from the same
habit of appending without looking:

- **Tokens.** The suffix rule — "a name the project already uses means
  something else here, so suffix rather than redefine it" — compared
  only names. A second import generates the same names for the same
  colours, so every one of them collided with itself and arrived again
  as `--color-N-imported`: a whole second palette that nothing
  referenced. A token whose value already matches is the one that was
  wanted, and is reused. The suffix still applies where the value
  genuinely differs, which is what it was for: the default theme's
  `--color-text` is not the imported page's.
- **The font import.** `@import url(…Inter…)` was appended each time,
  so a second import fetched exactly what the first already had.

Both are pinned by an e2e that imports the same fixture twice and
checks no token name is declared more than once and that one `@import`
line remains.
