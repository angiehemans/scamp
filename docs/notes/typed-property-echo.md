# Typed property vs. `customProperties` echo

## The invariant

When a CSS declaration is one Scamp routes to a typed field
(`font-weight`, `font-size`, `color`, …) **the typed field is the
source of truth**. If the same CSS property *also* appears in an
element's `customProperties` bag, the typed value wins and the
`customProperties` echo is ignored.

`generateCode` already enforces this on write: after emitting typed
declarations it drops any `customProperties` entry whose CSS property
name was already emitted (see the "drop-the-echo" note in
`generateCode/declarations.ts`). So the file on disk never carries the
duplicate.

## Why the echo exists at all

The parser can only type a declaration it recognises. Some values fall
through to `customProperties` even though the property has a typed
field:

- `font-weight: bold` / `lighter` / `bolder` — `cssPropertyMap` types
  numeric weights (and the exact keywords `normal`→400, `bold`→700);
  relative keywords still land in `customProperties`.
- Duplicate declarations in the source (`height: 100%; height: 100vh;`)
  where one value types and the other echoes.

So between "parse a file that had an un-typeable echo" and "user sets
the typed field from the panel", the in-memory element holds BOTH a
typed value and a stale `customProperties` echo.

## The canvas has to honor it too

`elementToStyle` spreads `customProperties` **last** so unmapped CSS
still renders. That means a stale echo would shadow the typed value on
the canvas — the panel and the generated file show the new typed value,
but the canvas keeps rendering the echo until the next save + reload
(which drops the echo). The fix: `elementToStyle` skips a
`customProperties` key when the element has the corresponding typed text
field set (`TYPED_TEXT_CSS_PROPS`), so the canvas applies the same
"typed wins" rule as the generator and stays consistent with the file.

Symptom this fixes: changing font-weight on a text element didn't update
the canvas (only reflected after close+reopen), because the element was
seeded with a keyword `font-weight` that lived in `customProperties`.
