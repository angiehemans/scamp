# What Claude Code got wrong building a Scamp-framework project — report

Written 2026-09-21 from a read of `~/Documents/scamp-files/ecommerce-store`
(a two-view store built by Claude Code running in Scamp's integrated
terminal) against Scamp's own parser, generator, canvas renderer, MCP
tools, and `agent.md` template. Findings were verified by running
`parseCode` and `generateCode` directly over the project's files. No
project or repo files were modified.

The reported symptom: the product images don't show up on the canvas.

Short version: **that one is ours.** The agent wrote a correct attribute
binding; Scamp's parser drops bindings on `<img>` and leaks an internal
marker into the typed `src`. Of the rest, five are genuine agent
mistakes and all of them are minor. The systemic problem is that
`agent.md` is two documents in one file — the scamp-format template is
the Next.js template with two paragraphs swapped, and the other 34
Next.js references pass straight through.

1. **Bound `<img>` sources never decode.** `src={photo.src}` parses to
   `src: "__scamp_bind__:photo.src"`. The canvas renders a dead URL, and
   a full regeneration writes the marker back into the TSX as a literal.
2. **`AGENT_MD_CONTENT_SCAMP` is a two-line diff off the Next.js
   template.** Everything after the layout paragraph still describes
   `app/page.tsx`, `app/layout.tsx`, `next.config.ts`, `app/theme.css`,
   and `next dev`.
3. **Every MCP tool is a read-only getter.** Nothing tells an agent
   whether what it just wrote survived the parse. In this run, nothing
   would have.

---

## 1. Why the product images are missing

The hero image on Home renders. The six product images don't. The
difference is that the hero's `src` is a string literal and the product
images' `src` is a binding.

Before tokenizing, `parseCode/bindings.ts` rewrites every `attr={expr}`
into `attr="__scamp_bind__:expr"` so the HTML tokenizer keeps the
expression whole. `readBindings` in `parseCode/tsx.ts` then decodes the
marker back into the element's `bind` map. But when the tag is `<img>`,
`src` and `alt` are added to `skipAttrs` and lifted straight out of the
raw attribute bag into the typed fields — so `readBindings` never sees
them, and the marker is never decoded.

`src/renderer/lib/parseCode/tsx.ts:680-706`:

```ts
const typedImgSrcAlt = type === 'image' && name === 'img';
const skipAttrs = new Set(['data-scamp-id', 'className', 'classname']);
if (typedImgSrcAlt) {
  skipAttrs.add('src');      // ← never reaches decodeBinding()
  skipAttrs.add('alt');
}
const elementBindings = readBindings(attribs, skipAttrs);
…
src: typedImgSrcAlt ? (attribs['src'] ?? null) : null,   // still marked
alt: typedImgSrcAlt ? (attribs['alt'] ?? null) : null,
```

### What the parser actually returns

Running `parseCode` over the project's own `views/Home/Home.tsx` and
`Home.module.css`. The `<a>` wrapping each card and the `<img>` inside
it sit two lines apart in the same file:

```jsonc
// the <a> — href decodes correctly
{ "id": "c65b", "tag": "a",
  "bind": { "href": "product.url" },
  "repeat": { "over": "products", "as": "product" } }

// the <img> inside it — src does not
{ "id": "c87d", "type": "image",
  "src": "__scamp_bind__:product.image",
  "alt": "__scamp_bind__:product.name",
  "bind": undefined }
```

`ElementRenderer` then sets `props.src = element.src` verbatim — the
`scamp-asset://` rewrite only fires for `./` and `/` paths — so the
canvas emits `<img src="__scamp_bind__:product.image">`. That is the
broken image.

Only `<img>` is affected. `<video src={…}>` and `<iframe src={…}>` carry
their attributes through the generic bag and decode correctly; `src` and
`alt` on `<img>` are the only typed fields that bypass `readBindings`.

### The data-loss risk

The corruption is currently parse-only — no marker is on disk. But:

```
generateCode(parseCode(Home.tsx))
  → src="__scamp_bind__:product.image"
```

Any canvas save that rewrites that `<img>` tag destroys the binding for
real, and every product image becomes the same dead URL in the shipped
app, not just on the canvas. This is a file → state → file round-trip
violation; the state → file → state direction is stable, which is why
the existing round-trip test doesn't catch it.

`.scamp/context.md` currently shows `.product_img_a9a6` carrying
`position: absolute; left: 0; top: 0` — styles that are *not* in
`Product.module.css`. That view has unsaved canvas state sitting on the
element with the broken binding. Worth fixing the parser before anyone
saves that view.

### Why it shipped

No test in the repo binds an image source. `grep -rn "src={" test/`
returns nothing, across `viewBindings.test.ts`, `bindingEval.test.ts`,
and `bindingsSlice.test.ts`. The binding suite covers text, `href`,
boolean attributes, events, repeat, and show — the one attribute with a
typed field of its own is the one nothing exercises.

### The fix is three pieces, not one

Decoding the marker is necessary but not sufficient. `bindingEval.ts`
resolves row-bound *text* (`resolveText`) and row-bound *instance props*
(`resolveInstanceOverrides`); there is no resolver for a row-bound plain
attribute. That is why `href={product.url}` parses correctly and still
renders with no `href` on the canvas.

- Route `src` / `alt` through `readBindings`, then lift the decoded
  result into the typed fields.
- Give `bindingEval` a `resolveAttr` that reads row paths, and have
  `ElementRenderer` prefer it over the raw `element.src`.
- Make `generateCode` re-emit `src={expr}` from `bind`, and add the
  round-trip case to the binding suite — written first, and confirmed
  failing before the fix.

---

## 2. What the agent got right

Stated plainly so the follow-up work doesn't over-correct. Every
mechanical rule in `agent.md` that can be checked by script, this run
passed, across all four view/component file pairs.

| Checked | Result |
|---|---|
| Duplicate `data-scamp-id` within a file | None |
| Non-hex `_XXXX` suffixes | None — all `[0-9a-f]{4}` |
| `data-scamp-id` matching `className` | Every element |
| TSX classes with no CSS block, or CSS blocks with no element | None |
| `var(--token)` references undeclared in `theme.css` | None — all 33 resolve |
| Raw hex or `rgba()` literals in module CSS | None |
| Combined selectors, nested `@media` | None |
| Pseudo-classes on a foreign class | None — all five `:hover` rules are own-class |
| Breakpoint blocks at file bottom, matching the project table | Correct (768, 390) |
| Repeat shape: one element, `key={row.id}`, samples in the destructure | Correct in all five repeats |
| Text in text elements, never bare in a container | No raw fragments |
| Logic in `routes/`, presentation in `views/` | Cleanly separated |

It also used `font-size: var(--text-5xl)` rather than `clamp()`. Token
font sizes *are* panel-editable via `tokensForField('fontSize')`, which
`agent.md` doesn't say — the agent guessed right.

---

## 3. Findings, by owner

### Scamp

- **Bound `<img>` sources are dropped.** Section 1. The agent wrote the
  binding exactly as the documented attribute-binding form prescribes;
  nothing about its output should change.
- **Literal URLs get their ampersands escaped on regeneration.** The
  hero's `?w=2000&q=80` comes back as `?w=2000&amp;q=80`. JSX decodes
  the entity so it is semantically harmless, and it is stable across
  repeated saves rather than compounding — but it churns the file and
  looks alarming in a diff. Low priority; recorded so it isn't
  rediscovered as a bug later.

### Docs

- **The binding table never mentions images.** The five binding kinds
  are illustrated with `href={url}` and `disabled={!canStart}`. There is
  no example of a data-driven image, no note that `src` is a typed field
  rather than a plain attribute, and no warning that it behaves
  differently. Any catalogue, gallery, avatar list, or card grid walks
  straight into it.
- **"Images and static assets" describes a Next.js project.** It
  explains that "Next.js serves the `public/` directory at the URL root"
  and tells the agent to put files in `public/assets/`. The mechanism is
  still right — `ElementRenderer` maps `/x` to `<project>/public/x` for
  scamp-format projects too — but the justification is dead, this
  project has no `public/` directory, and nothing in the section covers
  remote URLs or data-driven sources. The agent went to Unsplash
  instead, which is a reasonable read of a section that gave it nothing.
- **`routes/` is barely documented.** The word appears four times in
  1,354 emitted lines, none of them showing a route file. No documented
  shape for `load()`, no `render` export, no `params()` for dynamic
  segments, no `RouteProps`. The agent produced a correct
  `routes/products/[slug].tsx` anyway — it had the `scampjs/runtime`
  types to read — but that's inference, not instruction, and it is the
  part of the project the agent owns outright.

### Agent

- **`filter: grayscale(100%) contrast(1.1)` loses both filters.**
  `contrast` is a typed filter kind but `FILTER_UNITS.contrast` is
  `'%'`, so the unitless `1.1` is refused and the whole declaration
  falls to `customProperties`. `contrast(110%)` would have kept both
  typed. The identical `filter: grayscale(100%)` on the product image
  did parse.
- **Per-side border and padding longhands aren't panel-editable.**
  `border-bottom`, `border-top`, and `padding-bottom` all land in
  `customProperties` — Scamp types the shorthands, not single sides.
  Used in four places on section dividers, which is exactly the kind of
  value a designer reaches for the panel to nudge.
- **Sample data contradicts itself.** `Home` defaults to
  `productCount = "6 products"` with three sample rows, so the canvas
  reads "6 products" above three cards. The route supplies all six at
  runtime, so it's canvas-only — but the canvas is what the designer is
  looking at.
- **A repeat where a plain binding belonged.** `Product` repeats
  `images` over an array the route always fills with exactly one
  element. It buys a `<figure>` wrapper and a repeat the designer now
  has to reason about, for a single product photo.
- **Row keys built from prose.** The `[slug]` route maps details to
  `{ id: '38mm brushed steel case', label: … }` — the display string
  doing double duty as the React key. It works, and it reads badly in
  the Data tab's row table, where `id` is a visible column.

---

## 4. `agent.md` is two documents in one file

This is the highest-leverage finding, and it has a single cause:

```ts
// src/shared/templates/agentMd.ts:2514
export const AGENT_MD_CONTENT_SCAMP = AGENT_MD_CONTENT.replace(
  NEXT_LAYOUT_PARAGRAPH,
  SCAMP_LAYOUT_PARAGRAPH
).replace(NEXT_WRAPPER_NOTE, SCAMP_WRAPPER_NOTE);
```

The scamp-format template is the Next.js template with two paragraphs
swapped. Its doc comment says "same conventions, framework layout,"
which is true only of the two paragraphs it replaces. The emitted
`agent.md` still carries 34 Next.js references (39 in the template
source); an agent reading top to bottom gets two incompatible mental
models with no way to know which is current.

Inventory, by line in the emitted `agent.md`:

| Line | What it says | What is true |
|---|---|---|
| 306 | "This is a Next.js App Router project" | scampjs — the file says so itself at line 11 |
| 307–309 | `app/page.tsx`, `app/[page-name]/page.module.css` | `views/<Name>/<Name>.tsx` |
| 313–319 | Don't modify `app/layout.tsx`, `next.config.ts` | Neither file exists |
| 318 | Design tokens live at `app/theme.css` | `design/theme.css` |
| 739–746 | "Next.js App Router routes are absolute… no `next/link` required" | URLs come from `routes/`; the file grammar is the contract |
| 765–783 | Static assets, framed entirely as Next.js `public/` serving | Mechanism survives, rationale doesn't; nothing on remote or bound sources |
| 1314–1330 | Preview "spawns `next dev`"; `next.config.ts` is "essential" | `scamp dev`, per `package.json` |
| 1339–1354 | Every "What NOT to change" bullet names `page.tsx`, `app/layout.tsx`, `next.config.ts`, `app/theme.css` | Protects eight files that aren't there, and none that are |

The fix is to fork the template rather than patch it — a real
`AGENT_MD_CONTENT_SCAMP` that shares the conventions sections and
declares its own structure, assets, preview, linking, and
what-not-to-change sections. See `docs/notes/nextjs-sunset.md` for what
"the Next.js path" is and when it can be removed together.

---

## 5. What to change, in order

All thirteen MCP tools in `src/main/mcp/tools.ts` are read-only getters.
Nothing tells an agent whether what it just wrote survived the parse.

1. **Fix the `<img>` binding, with the test first.** The three pieces in
   section 1. Write the failing round-trip case before the fix and
   confirm it fails — a bound `src` surviving `parseCode` →
   `generateCode` unchanged.

2. **Add `scamp_check_view`.** A view name in, a list of degradations
   out: bindings that didn't parse, declarations that fell to
   `customProperties` when a typed form exists, undeclared tokens, ids
   that collided, samples that disagree with each other. `agent.md`
   currently tells agents to "use `scamp_get_element_tree` to confirm
   they parsed", which reports structure only — the tree for this
   project looks perfect.

3. **Rewrite `agent.md` for one framework.** Section 4 is the inventory.
   While in there: add a data-driven image to the binding table,
   document the route file shape, and correct the editability claims —
   token font sizes are fine, per-side borders are not, `contrast()`
   needs a percentage.

4. **Serve the conventions through MCP, not a file the agent may not
   read.** A `scamp_get_conventions` resource scoped to the project's
   actual format can't drift the way a 1,354-line file regenerated on
   every project open has. It also allows returning the short version by
   default and the detail on request, which is the opposite of the
   current shape.

5. **Make `scamp_get_view_props` report what it couldn't bind.** It
   answers from the parsed tree, so today it would have reported
   `Home`'s props as complete and correct while the image binding was
   already gone. A `warnings` field costs little and catches this class
   of failure at the moment the agent is writing the route.
