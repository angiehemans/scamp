---
title: "Round-trip contract: parseCode(generateCode(x)) === x"
related:
  - src/renderer/lib/generateCode.ts
  - src/renderer/lib/parseCode.ts
  - src/renderer/lib/defaults.ts
  - src/renderer/lib/cssPropertyMap.ts
  - src/renderer/lib/parsers.ts
---

# Round-trip contract: `parseCode(generateCode(x)) === x`

CLAUDE.md states the invariant; this note inventories *what* must hold
for it to be true and *how* it breaks when an invariant is violated or
when the input is non-Scamp JSX.

The canonical test lives alongside the lib tests (round-trip:
`generateCode → parseCode` reproduces the original state); the
component-scaffold variant is `test/component-scaffold-roundtrip.test.ts`.

Primary files: `src/renderer/lib/generateCode.ts`,
`src/renderer/lib/parseCode.ts`, `src/renderer/lib/defaults.ts`,
`src/renderer/lib/cssPropertyMap.ts`, `src/renderer/lib/parsers.ts`.

## The invariants

### 1. Default omission
`generateCode` only emits a CSS declaration when the element's value
**differs** from the baseline — `DEFAULT_ROOT_STYLES` for the root,
`DEFAULT_RECT_STYLES` for everything else (`elementDeclarationLines`,
compared against `BASE`). `parseCode` rebuilds each element by starting
from that same baseline and overlaying the parsed declarations
(`makeBaseline` + apply-declarations).

**Breaks if:** a default value drifts between the two sides. If
`DEFAULT_RECT_STYLES.backgroundColor` changed on only one side, a rect
with no explicit background would emit nothing but re-parse to the new
default — the round-trip silently changes the element's appearance.
*Both* sides must read `defaults.ts`; never hardcode a default in one.

### 2. customProperties passthrough
Anything the typed model can't represent is preserved verbatim in
`element.customProperties` and re-emitted **last** in the class block, in
insertion order (`generateCode` customProperties loop). Already-emitted
typed keys are skipped so a property is never written twice.

**Breaks if:** customProperties are dropped on parse or reordered ahead
of typed props on generate. Example: an agent's
`background-image: url(...)` would vanish on the next save.

### 3. Unknown CSS → customProperties (never discarded)
On parse, a declaration is routed by `isMappedProperty` /
`cssToScampProperty`: known property → run its mapper; **mapper returns
`null`** ("can't reduce this value to a typed field") → customProperties;
unknown property → customProperties. Nothing is discarded.

**Breaks if:** the unknown-property fallback is skipped. Example:
`mask-image: radial-gradient(...)` (not in the map) would be dropped and
re-generate without the mask. Also note value-level refusal: `padding:
50%` (non-px) is refused by the padding mapper and lands in
customProperties rather than the typed `padding` field — by design.

### 4. Text HTML-escaping (symmetric)
`generateCode` runs text content through `escapeHtml`
(`& < > " '`). `parseCode` runs htmlparser2 with `decodeEntities: true`,
which reverses it.

**Breaks if:** the two are asymmetric. Disable `decodeEntities` and
`Hello &amp; world` round-trips as the literal `&amp;`, then
double-escapes to `&amp;amp;` on the next generate.

### 5. Depth-first child order
`generateCode` walks the tree depth-first in `childIds` array order
(`collectElementsDfs`, and the JSX `childIds.forEach`). `parseCode`
rebuilds `childIds` in source-encounter order.

**Breaks if:** the orders disagree — children silently swap on each
round-trip.

### 6. Class-name derivation
`classNameFor`: `root` for the root, else `${name-or-type-prefix}_${id}`.
`parseCode` recovers the type from the prefix (`inferElementType`) and
the custom name by stripping the `_${id}` tail.

**Breaks if:** the id-tail stripping logic and the name-join logic
disagree — the custom name is lost or mangled on parse.

### 7. Component-instance identity
Instances are marked with `data-scamp-instance-id`; their
`componentName` is recovered from the page's `import` statements
(`scanComponentImports`). No class block is generated for an instance.

**Breaks if:** the import is missing/renamed — the instance parses but is
flagged `missingComponent` (the tag name is still preserved, so the
reference survives a round-trip; the renderer shows an error state).

### 8. Breakpoint / state overrides are partial
Overrides store only the fields the user explicitly set; emit guards each
field with a presence check (`breakpointOverrideLines`), so an absent
field inherits from the base via the cascade.

**Breaks if:** the emitter walks all fields instead of only-present ones
— it re-emits base values at breakpoint/state scope and breaks the
cascade (e.g. a `@media` block pins `height` the user never overrode).

## Failure modes on non-Scamp JSX

`parseCode` is intentionally forgiving — it does not throw on most
unsupported input; it degrades:

- **No `className={styles.X}` / unclassed element** → treated as an inline
  JSX fragment, captured verbatim in `inlineFragments` and re-emitted
  untouched (not a canvas element).
- **Non-semantic tag** → mapped by tag: `<div>` → rectangle, `<p>`/text
  tags → text. An agent's `<section>` falls back to rectangle and loses
  semantic meaning on the round-trip.
- **Unknown CSS property / refused value** → customProperties (see #3).
- **Component instance with missing import** → parsed, `componentName`
  inferred from the tag, flagged `missingComponent`.
- **Malformed CSS** → `postcss.parse` failure is caught; the page
  reconstructs from defaults (empty/typed baseline) rather than throwing.
- **Unsupported selectors** (pseudo-classes other than the recognised
  states, media queries that aren't `(max-width: Npx)`) → preserved
  verbatim as custom selector blocks and re-emitted.
- **Text `{expr}`** → hydrated to a prop ref only if the component
  destructures a matching prop; otherwise kept as literal text
  (`"{unknownVar}"`).

The one hard failure surface is the *load effect* in `ProjectShell`: if
`parseCode` itself throws, the canvas keeps its last good state and shows
the `ParseErrorBanner` (see that component + the page/component load
effects). It does not blank the canvas.
