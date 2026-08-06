# Selection highlighting in the code panel

Selecting an element on canvas highlights its lines in both code panes and
scrolls them into view, so "where is this in the code" needs no searching.

Code: `src/renderer/lib/codeHighlight.ts` (which lines),
`src/renderer/src/components/HighlightedCode.tsx` (CodeMirror plumbing),
wired up in `CodePanel.tsx`.

## Why it works on text, not a parse tree

The panel shows **what is on disk**, not what `generateCode` would emit now —
an agent or an editor may have reformatted it since. So the finders anchor on
things that survive reformatting:

- **TSX**: the `data-scamp-id="<class>"` attribute. Component instances use
  `data-scamp-instance-id` instead, and both are matched.
- **CSS**: the selector text, then brace matching to the end of the rule.

Anchoring on generated indentation or line offsets would break the first time
anything touched the file.

## What gets highlighted

**TSX** — the single line carrying the element's opening tag. Not the whole
subtree: for a container that would be most of the file, and for the root it
would be all of it.

**CSS** — every rule block whose selector targets the class: the base rule,
state variants (`.rect_a1b2:hover`), and the copies nested inside `@media`
blocks. The breakpoint override is often exactly what the user came to see.

Only the **inner** rule of a media query is highlighted, never the `@media`
wrapper — the wrapper holds unrelated elements' overrides too.

## Things that are easy to get wrong

- **Substring matching.** `rect_a1` must not match `rect_a1b2`. The TSX
  matcher requires the full quoted value; the CSS matcher requires the class
  not to run on into another identifier character (so `.rect_a1b2x` is not a
  match).
- **Braces in strings and comments.** `content: "}"` and `/* } */` both end a
  block early under naive counting, so the CSS is masked first — comments and
  quoted strings become spaces, with newlines preserved so line numbers stay
  aligned.
- **Component instances own no CSS class.** `classNameFor` returns their
  `inst_…` id, which appears in the TSX but never in the CSS. An instance
  therefore highlights in one pane only. That's correct, not a bug.
- **Multi-select.** Only the primary selection is highlighted. Lighting up
  several scattered regions gives no way to tell which is which.

## CodeMirror plumbing

The decorations live in a `StateField` updated by a `StateEffect`, **not** in
a rebuilt extension array. Reconfiguring the editor on every selection change
resets scroll position and fold state — the very things the user is trying to
keep hold of.

`onCreateEditor` applies the ranges once on mount as well as via the effect:
the editor mounts after the first effect run, so without it, opening the panel
with something already selected shows no highlight until the next change.

## Testing

`test/codeHighlight.test.ts` covers which lines, including reformatted and
hand-edited shapes. `test/e2e/code-output/selection-highlight.spec.ts` covers
whether the decoration reaches the DOM — the StateField plumbing is the part
that can silently do nothing while every unit test passes.

Panes are addressed in the e2e by `data-pane="tsx" | "css"`. A
class-substring selector also matches `paneHeader` and silently picks the
wrong element.
