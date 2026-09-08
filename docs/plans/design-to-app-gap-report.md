# Why the Noise With Friends app had to work around Scamp — report

Written 2026-09-08 from a read of `~/Documents/scamp-files/noise-with-friends`
(the Scamp design plus the Claude Code–built Cloudflare backend) against
Scamp's own parser, generator, page discovery, and agent guidance. The
goal it is measured against: **design a page fully in Scamp, then in that
same page write whatever JavaScript brings in real data, interactivity,
`'use client'`, and so on.**

Short version: the workarounds are not the agent being lazy. They are the
correct response to two hard limits in Scamp, and both limits are
architectural rather than bugs.

1. **A `page.tsx` is generated output, not a source file.** Scamp
   re-emits the whole file from its element tree on every canvas save,
   and its parser reads the file as HTML. Anything that isn't a
   `data-scamp-id` element is dropped or corrupted on the next save.
2. **Scamp only knows `app/<name>/page.tsx`.** Route groups, dynamic
   segments, and nested folders are invisible, and the page-name rule
   forbids them.

Everything the agent built around Scamp follows from those two.

## 1. What the agent actually built

The commit `4b1af75 Noise With Friends: Scamp design + Cloudflare backend`
and its follow-ups produced a strict two-layer structure. The agent wrote
the rule down in `ADMIN-PLAN.md` §5:

> Same rule as the rest of the app: the design pages are static and
> canvas-editable, the live screens import their CSS modules.

| Layer | Where | What it is |
|---|---|---|
| Design pages | `app/host/page.tsx`, `app/lobby/`, `app/player/`, `app/results/`, `app/prompts/`, `app/setup/`, `app/waiting/`, `app/admin-login/`, `app/admin-prompts/`, … | Untouched Scamp output. Static. Never rendered by the running game. |
| Live screens | `features/host/HostScreen.tsx`, `features/player/PlayerScreen.tsx`, `features/results/`, `features/setup/`, `features/admin/` | Hand-copied JSX from the design pages, with `'use client'`, hooks, props, `.map()`, handlers — **importing the design page's CSS module** (`import host from '@/app/host/page.module.css'`) so the look has one source. |
| Live routes | `app/game/[token]/host/page.tsx`, `…/[seat]/page.tsx`, `…/prompts/`, `…/results/`, `app/admin/page.tsx`, `app/admin/prompts/page.tsx`, `app/new/page.tsx` | 7–14-line wrappers: read `params`, render the screen. |
| Extra CSS | `features/ui/live.module.css` (160 lines) | "Styles that only the live screens need: control layouts, disabled states, overlays … This file is not a Scamp page and is never parsed by the canvas." |
| Page chrome | `features/ui/Shell.tsx` | The host page's topbar, re-implemented once so every live screen shares it. |

So every screen exists twice: a design copy Scamp can edit but the app
never renders, and a live copy the app renders but Scamp can never see.
Edit the design and the change reaches the live screen only through the
shared CSS module — structure and copy don't propagate. That is exactly
the split the goal rules out, and the agent arrived at it deliberately.

Three smaller tells in the same codebase:

- **`components/Player1` … `Player4`** are four components with the same
  markup. Scamp has no way to say "this container repeats for each
  player", so the design carries four copies; the live screen throws
  them away and uses one `PlayerCard` in a `.map()`.
- **`components/BuzzerButton`** is a design component whose `<button>`
  can't carry an `onClick`. The live screen doesn't use it at all —
  `HostScreen.tsx:222` rebuilds the buzzer by hand out of the page's
  classes plus `live.buzzer` / `live.buzzerPressed` state classes.
- **`app/layout.tsx`** is Scamp-managed and `agent.md` says never to
  modify it, so the shared topbar could not live in a layout; hence
  `Shell.tsx`.

## 2. Root cause 1 — the page file is owned by the generator

### The contract, as Scamp states it

`agent.md`, the file Scamp writes into every project, tells agents:

- "Do not alter the import line at the top of any `page.tsx` file."
- "Do not rename the default export function in any `page.tsx`."
- "Do not modify `app/layout.tsx`."
- "Each page exports a single default React component."

There is no guidance anywhere in `agent.md` about `'use client'`,
hooks, props, data fetching, event handlers, or expressions — because
none of them survive. The agent read that correctly.

### What the parser sees

`src/renderer/lib/parseCode/tsx.ts` hands the **entire file** to
`htmlparser2`, an HTML parser. Consequences:

- Everything outside a tag — the directive, the imports, the function
  signature, hooks, early returns, helper functions — is text between
  tags to an HTML parser, and nothing captures it. There is no notion of
  a preamble anywhere in `parseCode` or `generateCode`.
- Attribute values are strings. `onClick={() => act('/advance')}` is
  tokenised on whitespace like any HTML attribute and lands in the
  element's `attributes` bag as fragments.
- A JSX expression between elements — `{snap.status === 'lobby' ? … : null}`,
  `{players.map((p) => (…))}` — is loose text, kept as an
  `inlineFragments` entry and **HTML-escaped on the way out**.

### What the generator writes

`src/renderer/lib/generateCode/tsx.ts` → `generateTsx` builds the file
from scratch: a `styles` import, one import per referenced component, a
fixed signature `export default function Name()` (props only for
components, and only `?: string` text props and `React.ReactNode`
slots), `return (` the tree `)`. There is no slot for anything the file
used to contain.

### The experiment

I took the shape of `app/host/page.tsx`, added the five things a live
page needs — `'use client'`, two imports, a prop, two hooks with an early
return, a template-literal prop, a ternary, a `.map()` over a Scamp
subtree, and a button with `onClick` and `disabled` — and ran it through
`parseCode` then `generateCode`. This is what Scamp writes back:

```tsx
import styles from './host.module.css';
import RoomTag from '@/components/RoomTag/RoomTag';

export default function Host() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <header data-scamp-id="topbar_a0c2" className={styles.topbar_a0c2}>
        <RoomTag data-scamp-instance-id="inst_4b2e" label="{`Room" ${snap.token}`}="" />

        {snap.status === &#39;lobby&#39; ?
        <p className={styles.kicker}>Waiting</p>
         : null}

      </header>
      <section data-scamp-id="stage_a0d5" className={styles.stage_a0d5}>

        {snap.players.map((p) =&gt; (

        <div data-scamp-id="player_row_c1f8" className={styles.player_row_c1f8} key="{p.seat}">
          <p data-scamp-id="player_name_c1f9" className={styles.player_name_c1f9}>{p.name}</p>
        </div>

        ))}

        <button data-scamp-id="next_button_b320" className={styles.next_button_b320} type="button" onClick="{()" =>act(&#39;/advance&#39;)} disabled={buzzed}&gt;
          Next prompt →</button>
      </section>
    </div>
  );
}
```

Line by line: `'use client'` gone; the React and `features` imports
gone; the `{ token }` prop gone; both hooks and the loading return gone;
the template-literal prop shattered into three attributes; the ternary
and the arrow function HTML-escaped (`&#39;`, `=&gt;`); `key={p.seat}`
turned into the string `"{p.seat}"`; and the `onClick` split into
`onClick="{()"` with the rest of the tag spilled into a text node. The
file no longer compiles. **One canvas nudge after the agent wired the
page up would have destroyed its work**, which is why it never wired the
page up.

What does survive: the Scamp elements, their classes, `{p.name}` as a
text body (the parser keeps raw text), string attributes like `type` and
`placeholder`, and unclassed JSX *subtrees* (`<p className=…>` inside
the ternary came through intact — the fragment mechanism works for
tags, just not for the expressions around them).

## 3. Root cause 2 — one level of pages

`src/main/ipc/projectScaffold.ts` → `readProjectNextjs` reads
`app/page.tsx` and then **one** `readdir` of `app/`, looking for
`app/<entry>/page.tsx`. Nothing recurses. Around it, the same
assumption is baked in four more places:

| Where | The assumption |
|---|---|
| `pageOps.ts` `PAGE_NAME_RE = /^[a-zA-Z0-9-]+$/` | A page name has no `/`, no `[…]`, no `(…)`. Create / rename / duplicate all reject anything else. |
| `pageOps.ts` `pagePathsFor` | name → `app/<name>/page.tsx`, so a page *is* its folder name. |
| `watcher.ts` `depth: 3` | "Depth=3 covers the deepest path Scamp cares about: `<projectRoot> → app → <page-folder> → page.tsx`." A file at `app/game/[token]/host/page.tsx` is below the watch depth — external edits there never reach the canvas even if Scamp could open it. |
| `snapshotOps.ts` `enumerateProjectFiles`, `canvasSnapshot.ts` `pagePathsRelative` | Snapshots and the MCP's file paths enumerate the same flat shape. |

In the app that means all of these are invisible to Scamp:
`app/game/[token]/host`, `…/[seat]`, `…/prompts`, `…/results`,
`app/admin/prompts`, and `app/api/**`. The agent's route wrappers live
there precisely *because* Scamp will neither list them nor touch them.
Note the two problems compound: even if nested routes were discovered,
they couldn't hold their `params`-reading wrapper code.

## 4. The secondary gaps the workarounds also reveal

Fixing the two root causes still leaves three things the app needed:

- **Repetition.** There is no way to design "one of these, repeated for
  each item". Hence `Player1`–`Player4`, and `{h.links.players.map(…)}`
  living only in the live copy.
- **Interactive components.** A Scamp component's props are text
  (`?: string`) and slots (`React.ReactNode`); it cannot accept an
  `onClick`, a `disabled`, or a `value`/`onChange` pair. `PasswordField`
  in `ADMIN-PLAN.md` is where the agent talks itself around this
  ("`children` (the input, passed from the page) *or* `value`/`onChange`
  like `ToggleField`").
- **Shared chrome.** Every screen shares a topbar. With `layout.tsx`
  off-limits and no layout concept in Scamp, the topbar was copied into
  `Shell.tsx`, which imports the *host page's* module for its classes —
  a dependency from the app on a page that is otherwise unused.

## 5. What "design it in Scamp, then write the JS in the same page" requires

Stated as the shape of the change, not a schedule.

### 5.1 Change what Scamp owns: the subtree, not the file

Today Scamp owns `page.tsx` outright. The goal needs Scamp to own only
the JSX subtree rooted at `data-scamp-id="root"` plus the CSS module,
and to treat everything else in the file as the user's — preserved
byte-for-byte: directives, imports, the signature and its props, hooks,
statements before the `return`, other functions, and, inside the JSX,
every `{…}` expression.

That flips the generator from **regenerate** to **splice**: parse the
file, locate the owned subtree, replace exactly that range with fresh
output, leave the rest untouched. Scamp already does precisely this for
CSS — `patchClassBlock` in `shared/patchClass.ts` rewrites one class
block and leaves the rest of the module alone. The TSX side needs the
same idea.

### 5.2 A real parser

`htmlparser2` cannot do 5.1. Locating a subtree in a TSX file and
preserving `{…}` needs a JSX-aware parser with source positions —
TypeScript's own parser (already in the project via `typescript`) or a
small JSX tokenizer. This is the single largest technical change in
the list and the one everything else depends on. The round-trip
invariant extends naturally: *splice(parse(file)) === file* for any
file Scamp didn't change.

Within the JSX, the rules that fall out:

- an attribute whose value is `{…}` is opaque and preserved verbatim
  (never quoted, never escaped) — `onClick`, `key`, `disabled={x}`,
  `label={\`…\`}` all become safe;
- an expression child is an opaque fragment, whether it contains Scamp
  elements or not; `{items.map((p) => (<div data-scamp-id=…>…</div>))}`
  is "a repeated Scamp subtree inside an opaque wrapper".

A worthwhile intermediate step exists: preserve the preamble, the
signature, the pre-`return` statements, and `{…}` attribute values
verbatim, while still regenerating the tree. That alone would have let
the agent keep `'use client'`, the hooks, the props, and every handler
in `app/host/page.tsx`. Ternaries and `.map()` would still need the full
version.

### 5.3 Expressions on the canvas

The canvas can't evaluate `{snap.players}`. Three options, in
increasing ambition: render the expression's source text where a value
would go (honest, ugly); a per-binding **sample value** stored outside
the file (`.scamp/` or `scamp.config.json`) so `{p.name}` shows
"Elizabeth" on the canvas and the file stays clean; or a design-time
data mode. The second is the one that matches Scamp's local-first
shape — the sample never enters the shipped file.

### 5.4 Repeaters

A container marked "repeat over `<expression>`" renders N sample copies
on the canvas and emits the `.map()` wrapper in the file. This is what
makes `Player1`–`Player4` one component and one row on the canvas.
Depends on 5.1–5.3.

### 5.5 Routes

`readProjectNextjs` walks `app/**` for `page.tsx`, skipping `api/`;
a page's identity becomes its route path (`game/[token]/host`), shown
as such in the sidebar; `PAGE_NAME_RE` becomes a route-segment rule
that admits `[param]` and `(group)`; the watcher drops the depth cap in
favour of its ignore list; snapshots and the MCP path helpers follow.
This one is independent of the parser work and small — days, not
weeks — and it is worth doing first because it removes the reason the
route wrappers had to live somewhere Scamp can't see.

### 5.6 Components and layouts

Components get typed passthrough props beyond string and slot (an
`onClick?: () => void`, a `disabled?: boolean`), emitted on the
signature and forwarded where the user says. Layouts — a designable
`layout.tsx`, or a "shell" page others inherit — would have absorbed
`Shell.tsx`. Both are additive once 5.1 exists.

## 6. In one table

| Workaround in the app | Caused by | Fixed by |
|---|---|---|
| Design pages static; live screens are copies | §2 — file is generator-owned; logic is destroyed on save | 5.1 + 5.2 (splice, real parser) |
| `features/ui/live.module.css` | Live screens couldn't be Scamp pages, so their extra styles couldn't be Scamp styles | Same |
| Route wrappers under `app/game/[token]/…` | §3 — one level of pages, flat names, watch depth | 5.5 (small, independent) |
| `Player1`–`Player4` | No repetition | 5.4 |
| Buzzer rebuilt by hand | Components can't take handlers or state classes | 5.6 |
| `Shell.tsx` topbar | No layout concept; `layout.tsx` off-limits | 5.6 |
| `agent.md` never mentions logic | It couldn't — there was nothing safe to say | Rewrite once 5.1 lands |

The honest sequencing: **5.5 now** (cheap, removes the nested-route
half of the problem outright), then **5.2 → 5.1** as the real project,
with the intermediate "preserve the preamble and `{…}` attributes" step
as its first shippable milestone, then 5.3 → 5.4 → 5.6 as product
design allows.
