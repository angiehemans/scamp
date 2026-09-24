# Naming imported elements, and three things beside it

## The page has already named everything

Layer names of `box_0090` and `label_00a5` describe nothing, and the
work of renaming them was most of what an agent did by hand on a real
import. The page's own class list is right there in the capture.

`nameHintOf` takes a class only when it reads like a name, and rejects
more than it accepts:

- A CSS-module class carries the author's word after its hash —
  `Page-module__a1b2c3__title` gives up `title`.
- Every segment must be alphabetic. That one test removes `px-4`,
  `css-182dboe` and most other framework noise in one line.
- A short list of layout utilities (`flex`, `container`, `active`, …)
  is skipped: they say less than the tag does.
- A compound name wins over a single word, because `patient-card` is
  more specific than `card`.

With nothing to go on the tag name still decides, exactly as before.
One page went from `box`/`label`/`section` to `brand`, `nav_links`,
`eyebrow`, `hero`, `features`, `badge`, `legal`, `fineprint`.

**The one trap.** `parseCode` reads `text_`, `rect_`, `img_` and
`input_` as the element's TYPE before it looks at the tag. A page class
called `rect-grid` on a text element would come back a rectangle, so a
hint starting with one of those is dropped. The inverse is used on
purpose: a `<div>` whose only content is words is named
`text_<hint>`, which both pins the type and reads well.

## Gradient text arrives whole now

The idiom is a background clipped to the glyphs with the text painted
transparent. `background-image` was captured and the clip was not, so
82 elements on one page ended up with `color: transparent` and nothing
behind it — a headline nobody could see.

`background-clip`, `-webkit-background-clip` and
`-webkit-text-fill-color` are captured now. The last one needs a guard:
it resolves to the element's own `color` on everything that never set
it, so keeping it unconditionally would put a second colour on every
element on the page. It is dropped wherever it agrees with `color`,
which leaves exactly the case it was added for.

## A `<span>` is as empty a wrapper as a `<div>`

The collapse pass only removed single-child `<div>`s, which left the
other half of the idiom standing — about 25 spare `<span>`s around
group labels, nav icons and breadcrumbs on one page. Both tags are in
the set now. Nothing semantic is: a `<nav>` or a `<section>` says
something about the page even when it paints nothing.

## `scamp_check_view` was answering from before the edit

Reported as "it kept returning its report from before the edit,
byte-for-byte identical, even after the canvas had loaded the new
file" — and that is exactly what it was.

`componentTrees` is what `scamp_check_view` and `scamp_get_view_props`
answer from. It is built once, from `project.components`, when the
project loads. The external-edit handler reloads the CANVAS from the
file and never touched it, so the two readers of that file disagreed:
the canvas was current and the tools were not.

It is refreshed from the same parse now, and before the round-trip
bail — that bail means the canvas needs no reload, not that these trees
were already right. Pinned by a direct test rather than e2e, because
the staleness is invisible on screen: the canvas is right and only the
answer is wrong.

## Not doing: importing the page's own tokens

The page defines its palette in `:root`, and reading it would remove
the last of the theme work. Deliberately left out — the user decides
what becomes a theme value and what stays a literal, and an importer
that lifts every custom property makes that decision for them.
