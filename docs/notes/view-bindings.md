# View bindings — the model-to-file mapping

How a view's (or component's) bindings are stored on `ScampElement` and
written to the file, and how the parser reads them back. The contract
is `CONTRACT.md` in the scampjs repo (section 1.3); this is the app's
side of it. see docs/plans/framework-phase-1-plan.md, step 3.

## Five kinds, and where each lives

| Kind | On the element | Sample lives | Emitted as |
|---|---|---|---|
| Text | `prop: 'code'` (a text element) | `el.text` | `{code}` |
| Attribute | `bind: { href: 'url' }` | `el.attributes.href` (instances: `propOverrides.label`) | `href={url}` |
| Boolean attribute | `bind: { disabled: '!canStart' }` | presence of `el.attributes.disabled` | `disabled={!canStart}` |
| Event | `on: { onClick: 'onStart' }` | none | `onClick={onStart}` |
| Repeat | `repeat: { over: 'players', as: 'player', key? }` on the repeated element | `root.samples.players` (rows) | `{players.map((player) => (…))}` + `key={player.id}` |
| Show | `showIf: 'waiting'` on the shown element | `root.samples.waiting` | `{waiting && (…)}` |

Inside a repeat, text and attribute bindings may be **row paths**
(`prop: 'player.label'`, `bind: { url: 'player.url' }`); those are not
props and carry no sample of their own — the rows on the root are the
sample. An event inside a repeat emits `onClick={() => onCopy?.(player.id)}`
and types as `(id: string) => void`, named after the key field.

`repeat.key` is stored only when it isn't `id`: the generator writes
`key={row.id}` by default, and the parser drops a parsed `id` back to
absent, so a hand-written file and its regeneration parse the same.

Show wraps repeat when both are on one element. The Data tab keeps them
on separate elements in practice.

## The props type

`lib/viewProps.ts` walks the tree and returns the props in contract
order: every non-event prop in document order (per element: show,
repeat, the text prop, then bound attributes in binding order), then
events, then slots; the generator appends `className`. Types: `string`,
`boolean` (boolean attributes and show flags), `Array<{ … }>` from the
sample rows (a field is `number` when every row holds a number),
`() => void` / `(<key>: string) => void`, `React.ReactNode`. The
destructure carries the defaults, and goes multi-line as soon as a
repeat's rows are in it. `_scamp.events` is the event list in that
order.

## Parsing

`parseCode/bindings.ts` runs after the named-slot hoist and before the
structural parse:

- `attr={expr}` on a Scamp element or instance becomes
  `attr="__scamp_bind__:expr"` so the tokenizer keeps it whole; JSX
  values (`{<…>}`), `className={styles.x}`, and expressions holding a
  brace or quote are left alone. `readBindings` in `tsx.ts` decodes the
  marker into `bind` / `on`, a `key={row.field}` into the repeat key, and
  anything else back to a verbatim `{expr}` attribute value (which the
  generator writes unquoted).
- The wrappers become pseudo-tags — `{list.map((row) => (` →
  `<scamp-repeat over="list" as="row">`, `{flag && (` →
  `<scamp-show if="flag">` — matched to their closers by line and
  indent, which the generator fixes. The structural parse attaches a
  pending wrapper to the next real element it opens.

`parsePropsDefaults` reads the destructure brace-aware: strings,
booleans, and arrays of flat rows. The post-pass in `index.ts` then
writes each bound attribute's default back into the literal's place,
hydrates `{row.field}` text as a row-path prop (with no text), and puts
show flags and repeat rows on the root as `samples`.

## What the canvas does

`lib/bindingEval.ts` resolves references against the root's samples and
the current row: a row path reads the row, anything else reads the
samples, `.length` works on rows, and `!` inverts. A flag with no
sample reads as true (the props type's default), so `!flag` hides.

Both render paths — `ElementRenderer` for pages, components, and views,
and `renderComponentSubtree` for instances on a page — expand a
parent's children through `expandChildren`: a hidden child is dropped,
a repeated child renders once per sample row with that row in scope,
everything else inherits the row. A row-bound text resolves from the
row and isn't an editable prop; a row-bound instance prop resolves
into the instance's overrides. Attribute samples need no evaluation:
the literal in `attributes` is the sample. Events render nothing.

Copies of a repeated element beyond the first carry no
`data-element-id` and no ref, so hit-testing, selection, and
measurement land on the first copy. A parent subscribes to a key of its
children's show and repeat bindings (`childBindingKey`) rather than to
the whole element map.

The parity fixture `binding-repeat-and-show` proves the canvas against
a browser rendering the same defaults.
