# Bringing `<span>` into the canvas

## Why a span is different from a `<strong>`

Inline markup inside a text element is kept as verbatim JSX — a
fragment — rather than becoming boxes, because making a flex item of
every word-run destroys the line box (a measured 81x43 paragraph came
back 304x100). That is right for `<strong>`, `<em>`, `<sup>`, `<a>`:
the browser styles them, so a bare tag still looks like itself.

A `<span>` is the opposite. It has no appearance of its own —
everything it looks like comes from a class the import does not carry.
Emitted as a bare `<span>`, every bit of it is gone. On one page a
headline's highlighted word, a coloured pill with padding and a
radius, came across as `<span>busywork.</span>` and rendered as plain
text.

So the rule is not about tags, it is about whether anything survives
being written out bare. A span that differs from its parent on
anything visible — or that is not an inline box at all — becomes a
real element; one that adds nothing stays a fragment.

## Three things that had to be true

**A flex or grid container has no inline content.** `inlineContentOf`
decided "running text" from the tag alone, so a `display: flex` span
holding a logo's three parts was read as a sentence, and its children
were flattened to bare tags. A layout container's children are items it
lays out, whatever tags they happen to be.

**A host cannot hold both words and children.** The generator drops the
text when an element has children — that is the rule `needsTextChild`
exists for. So once one span in a run becomes an element, every text
run in that run has to become one too, and the host is left a pure
container whose children flow as a line. With no styled span in the
run nothing changes, which keeps the common case exactly where it was.

**A child of a text host is `position: absolute`.** Scamp's tree-shape
rule pins any child of a non-layout parent at 0,0, which would lift the
word out of its sentence. The typed `position: static` is the escape
hatch, and these children get it explicitly, along with `width: auto`
and `height: auto` so an inline box hugs its words instead of a
measured width deciding where they wrap.

## The round-trip bug underneath it

`parseCode` types a tag with element children and no text of its own as
a **rectangle**, and `generateCode` emits typography only for text
elements. So a heading whose words had moved into spans was written
with `font-size: 56px` once and regenerated without it: the file
rewrote itself on the first save and the heading fell back to 16px.

The fix is the same principle as `resolveInheritance` — put the
declaration on the element that renders the words. Each lifted run and
each styled span carries the host's typography, and the host, which can
no longer keep it, gives it up. `test/importReduce.test.ts` pins this
with a generate → parse → generate comparison on the real fixture.

## `display: inline-block` could not be written down

It was folded onto the same typed sentinel as `display: block`, and
since that sentinel is also the default, nothing emitted it back:
`display: inline-block` written into a CSS module disappeared on the
next save. Both are "not a flex or grid container", but only `block` is
what an element already does without saying so. `inline-block` now
falls through to `customProperties` like `inline` and `flow-root`
always did — which is what lets a highlighted word be a box that sits
in a line.

See also `docs/notes/import-inherited-typography.md`.

## The inline run was not text at all

`<span class="auth-wordmark"><span>Resova</span><b>iQ</b><sup>®</sup></span>`
lost two of its three parts.

`TEXT_TAGS` — the set that decides whether a tag becomes a text element —
listed `strong` and `em` but not `b`, `i`, `u`, `s`, `sub`, `sup`,
`mark`, `abbr`, `cite`, `q`, `kbd`, `del` or `ins`. Those became
rectangles, and **a rectangle carries no text**, so `<b>iQ</b>` was
emitted as `<b />`: the element was there, correctly tagged and
classed, with the word gone. An empty box is what the user saw.

It had never mattered before, because these tags only ever appeared
inside a verbatim inline run. Making a flex host's children into real
elements is what first routed them through `elementTypeFor`.

Two lists had to move together. `importReduce`'s `TEXT_TAGS` mirrors
`parseCode`'s, and the comment on it says so. Adding the tags to the
importer alone would have written `<b>iQ</b>` once and regenerated it
empty, because the parser would still have read it as a rectangle —
the same self-rewriting file as the typography bug above.

With them as text elements, each part keeps its own type: in the
fixture the `<b>` resolves to weight 900 against its 700 parent and
takes the brand colour, while the `<sup>` keeps its 10px. That is three
elements you can edit where there used to be one bare tag.

## `<em>`, `<a>`, and the rule that was about tags

The span fix was scoped to `<span>`, justified as "`<strong>` and `<em>`
survive as bare tags because the browser styles them". That holds only
while the page has not restyled them. On one page it had: an `<em>`
carrying a whole 10px small-print treatment — its own size, weight,
line-height, top margin and max-width — of which a bare `<em>` keeps
the italic and nothing else.

So the rule is now per tag rather than per span: `INLINE_TAG_AFFORDANCES`
lists what each tag brings for free, and anything visible beyond that
makes an element. `a` and `button` bring **nothing**, deliberately —
Scamp's own reset does `all: unset` on them, so even the default link
colour is gone by the time the page renders.

That last point is why an inline `<a>` had to become an element rather
than stay a fragment. As a bare fragment it got `all: unset; display:
block` from `theme.css`: grey instead of link-blue, and taking the whole
paragraph width on a line of its own. A fragment has nowhere to carry a
colour, so only an element with its own class can hold it.

## Two display values that could not be written down

`display: inline-block` was the first (above). `display: block` on an
inline tag was the second, and it hid the same way: the model's "not a
flex or grid container" sentinel is also its default, so it emits
nothing — which reads as `block` on a div and as `inline` on an `<em>`.
A block-level `<em>` was therefore inexpressible, and the imported
disclaimer flowed back into the sentence above it.

The generator now spells out `display: block` for an inline-by-default
tag, and only where it is observable: not for a flex or grid item, which
its parent blockifies, and not for an absolutely positioned box, which
is out of flow. Both exclusions matter — without them every `<span>`
element in every existing project would gain the declaration, which the
published contract-0 fixture caught immediately.

## The bug under all of it: a container could not keep its type

`generateCode` emitted typography only for text elements. `parseCode`
parsed it into typed fields regardless. So a container declaring
`font-size: 14px` for its children to inherit had it read, held, and
then dropped on the next save — the file rewriting itself smaller, and
every text child falling back a size. `color` had already been fixed
here for exactly this reason; the rest of the inherited set had not.

That single omission is what made the earlier workarounds necessary:
moving type onto the words, then stripping it from the host. Stripping
was itself wrong — a container's `font-size` and `line-height` set the
line box its inline children sit in, so removing them made one
paragraph seven pixels taller than the page it copied. With the
generator fixed, the container keeps what it declared, the words keep
their own copy, and nothing is lost either way.

Measured after: dev.resovaiq.com went to **100%** of elements within
2px of the source, scamp.club 86% → 89%, resovaiq.com 86% → 88%.
