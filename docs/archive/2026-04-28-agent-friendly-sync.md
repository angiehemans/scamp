# Agent-Friendly Sync — Plan

**Status:** Draft for review. Do not implement until approved.
**Date:** 2026-04-28
**Scope:** Make Scamp robust when an AI coding agent (Claude, Cursor, etc.) edits TSX + CSS files in a Scamp project. Stop overwriting agent intent; document the sync rules clearly in `agent.md`.

---

## What went wrong in the recent Claude run

Verbatim from the user's session, grouped by class of failure:

| Symptom | Root cause |
|---|---|
| `position: fixed` got stripped from the navbar | `position` isn't in `cssPropertyMap`. Anything not mapped should fall through to `customProperties` and round-trip — but Scamp's generator emits its own `position: relative / absolute` rule based on tree shape, *also* emits the carried-over `customProperties` value, and the generator's rule is upstream of the customProperties block. Either depending on order they cascade-collide, or the parser drops `position` entirely as "we know about this, but not for this element kind". |
| `var(--space-4)` inside `padding`/`margin`/`gap` shorthand → got overwritten with `0px 0px 0px 0px` | `parsePx` regex only accepts `^(-?\d+(?:\.\d+)?)(?:px)?$`. `var(...)` doesn't match → returns 0 → typed field becomes `[0,0,0,0]`. Original value is silently lost. |
| `border-radius: 50%` got rewritten as `0px 0px 0px 0px` | Same root cause — `parseBorderRadiusShorthand` walks tokens through `parsePx`. `50%` doesn't parse → 0 → original value lost. |
| Loose text + classed spans inside a flex parent got reordered, e.g. `Role: <strong>Designer</strong>` → `<strong>Designer</strong>Role:` | The TSX parser collects "raw text" and "classed children" separately and reassembles them in a fixed order rather than preserving DOM source order. |
| Spans without `data-scamp-id` / `className` got dropped | The parser only treats nodes with `data-scamp-id` as elements. Untyped JSX gets discarded on the way through. |
| Whole CSS file got rewritten on every change, normalising spacing, comments, declaration order | Scamp's sync bridge calls `generateCode` after every parse and writes the canonical output. Even when nothing changed semantically, formatting + ordering shift, which makes the agent feel like its work is being undone. |

The **deeper pattern**: Scamp treats the canvas state as the source of truth and the files as a render target. An AI agent treats the files as the source of truth and writes them deliberately. Today those two world-views collide and the canvas wins by default — even when the canvas didn't actually have any new information.

---

## Goal

A Scamp project should be a place an agent can write `home.tsx` and `home.module.css` by hand without Scamp clobbering its choices. Two requirements drop out of that:

1. **Lossless round-trip.** Anything Scamp doesn't model — `position: fixed`, `var()`-based shorthands, `border-radius: 50%`, custom selectors, comments — must come back out byte-equivalent (or close enough that diffs read as no-ops).
2. **Surgical writes.** When the canvas changes one element, Scamp should patch only that element's CSS class block, not regenerate the whole file. The `file:patch` IPC + tests for it already exist; the sync bridge just isn't using it for the common case yet.

Plus a documentation pass on `agent.md` so agents know the rules of engagement.

---

## Plan

Five tracks, ordered by impact-per-effort. Each can ship as its own PR.

### Track A — `agent.md` rewrite (1 PR, small)

`src/shared/agentMd.ts` controls what every new project's `agent.md` says. Today it covers the basics (data-scamp-id contract, file edit order, breakpoints). It needs to add:

- **What Scamp normalises and what it doesn't.** A short table of "if you write this, Scamp keeps it / changes it / drops it" so the agent has a mental model up front.
- **The class-block contract.** "One class, one rule block. Scamp will create empty class blocks for new elements you add to TSX. If a class block already exists with declarations, Scamp will leave it alone."
- **What to use for canvas-irrelevant CSS.** Comments, `@keyframes`, `@supports`, `@font-face`, hover/focus selectors — what's preserved verbatim and what's still a road less travelled.
- **A worked example.** Add a navbar with a sticky position. Show the TSX + CSS the agent should write, and what Scamp's response will be.
- **What NOT to do.** Don't combine selectors. Don't nest media queries inside class rules. Don't rename `data-scamp-id` to anything else. Don't put loose text fragments inside flex containers without wrapping them in classed elements (see Track D).

Out of scope here: changing actual Scamp behaviour. That's Tracks B–E. This track just sets correct expectations for whatever Scamp's behaviour ends up being.

### Track B — Parser: never lose data (1 PR, medium)

The user's specific suggestion — "if a class already has rules, don't touch it" — is correct in spirit. The cleaner architectural framing is: **the parser must be lossless**. If we can't reduce a CSS declaration to a typed field, it goes into `customProperties` verbatim. Then the generator emits it back out exactly as written.

Concrete changes in `cssPropertyMap.ts` + `parsers.ts`:

1. **Make typed parsers refusable, not lossy.** Today `parsePx('var(--space-4)')` returns `0`. Change it to return `null`, and let the caller (the cssPropertyMap entry for `padding`/`margin`/`gap`/`border-width`/etc.) detect the failure and fall through to `customProperties` with the raw declaration intact.
   - This affects: `padding`, `margin`, `border-radius`, `border-width`, `gap`, `column-gap`, `row-gap`, anything else that goes through `parsePx`.
2. **Same for `parseBorderRadiusShorthand`.** A `50%` token causes the whole shorthand to be unparseable — fall through to `customProperties` with `border-radius: 50%` preserved.
3. **Add `position` to the explicit pass-through list.** `position` is a real CSS property; today the parser silently treats it as unknown, the generator emits its own `position: relative / absolute`, and the user's `position: fixed` is lost. Either map `position` to a typed field (and decide what canvas semantics it has) or pin it to `customProperties` and ensure the generator's auto-position is suppressed when an element has its own.
4. **Customprops emit precedence.** Confirm by test that `customProperties` declarations come AFTER the generator's typed declarations, so a user's `position: fixed` in customProperties wins over Scamp's `position: absolute`.
5. **Tests:**
   - `padding: var(--space-4)` round-trips byte-equivalent.
   - `border-radius: 50%` round-trips byte-equivalent.
   - `position: fixed` + `top: 0` round-trips byte-equivalent.
   - Mixed: `padding: 16px; padding-top: var(--space-2);` parses padding=16-tuple AND keeps the longhand override in customProperties.

This single PR covers the user's main complaint without changing the sync model.

### Track C — Sync bridge: surgical writes when nothing's changed (1 PR, medium)

Even with Track B, today every chokidar event triggers a full file regenerate. That re-emits comments-stripped, declaration-order-shuffled CSS even when the canvas state matches what's on disk.

Two changes, both in `syncBridge.ts`:

1. **No-op detection on external edits.** When chokidar fires `file:changed`, the bridge already parses the new content, generates code from the new state, and only writes if `currentCode !== nextCode`. **But** it doesn't check whether `currentCode === diskCode`. So Scamp can read a file, parse it, regenerate a slightly different version, and write that back — even though the original was perfectly fine.
   - Fix: after parse, generate from the parsed state, diff against the disk content. If the difference is purely whitespace / declaration ordering / customProperties ordering, skip the write entirely. The agent's file is preserved.
2. **Surgical patches on canvas edits.** Today canvas edits run `flushPendingPageWrite` which writes the WHOLE file. The `savePatch` IPC already exists and is used by the CSS-mode editor. Refactor the canvas path to:
   - For each changed element: emit a `file:patch` against just that class block.
   - For NEW elements (added via canvas tools): scaffold the new block by appending to the file (existing patch IPC supports insert-if-missing — verify or add).
   - For DELETED elements: surgically remove just that class block.
   - The TSX file still gets a full regenerate (TSX is structural and harder to patch surgically; we accept the tradeoff there for now).

This is a meaningful refactor of how the bridge writes. Worth doing because it's the difference between Scamp-as-helper and Scamp-as-overwriter.

### Track D — Parser: preserve loose text and unclassed children (1 PR, small)

The reordering bug is independent of Tracks B/C. In `parseCode.ts`, when the parser walks a JSX element's children, it should keep DOM source order across:

- Classed elements (with `data-scamp-id`) → become canvas elements
- Loose text fragments → stay as text nodes attached to the parent
- Unclassed elements (raw `<span>`, `<br>`, `<strong>`) → preserve as inline TSX fragments

Concretely the parent element needs an additional ordered field — call it `inlineChildren: Array<{ kind: 'element', id: string } | { kind: 'text', value: string } | { kind: 'jsx', source: string }>` — that the generator walks in order. The existing `childIds` array remains for the canvas tree (what the layers panel shows), but the generator uses `inlineChildren` to emit TSX in the user's original order.

This is a parser + generator change. Tests:
- `Role: <strong>Designer</strong>` round-trips byte-equivalent through generate/parse cycles.
- A flex container with three loose text fragments interleaved with classed spans keeps the order.
- `<br>` inside a paragraph survives.

There's a UX implication: unclassed JSX inline fragments aren't manipulable via the canvas. They render but the user can't click them. That's correct — they're not Scamp elements.

### Track E — Declaration order preservation in generated CSS (1 PR, small)

Even after Tracks B–D, Scamp still uses a fixed declaration order in `elementDeclarationLines` (size, then layout, then padding, then border, …). If the agent prefers `position` first and `background` last, Scamp shuffles them on the next save.

Fix: when an element's typed values come from a parse and haven't been touched via the canvas, preserve the original declaration order. Track per-element: `declarationOrder: string[]` populated by the parser, consumed by the generator. New elements (created via the canvas) use the default order. This is purely cosmetic but agents care.

Lower priority than the others.

---

## Recommended sequencing

1. **Track A first.** Cheap, ships immediately, sets correct expectations. The other tracks can land in any order without it, but every day it isn't shipped is a day agents discover Scamp's behaviour the hard way.
2. **Track B.** Highest impact for the least architectural risk. Solves the `var()`/`50%`/`position: fixed` complaints from this run.
3. **Track D.** The loose-text bug is concrete and has a clear fix; the user-visible quality jump is large.
4. **Track C.** The biggest architectural change. Worth doing but worth doing carefully — the surgical-write path needs solid tests for the create / update / delete paths and the no-op-detection logic.
5. **Track E.** Polish. Skip until the others land.

---

## Open questions for review

1. **Track A — `agent.md` size.** Today it's ~80 lines and reads quickly. Adding the table + worked example pushes it to ~150. Worth it? Or keep `agent.md` lean and put the long-form best-practices in a separate `docs/agents.md` linked from `agent.md`? I think its worth keeping it in agent.md
2. **Track B — `position` semantics.** Two options: (a) leave `position` as a customProperties pass-through, suppress Scamp's auto-position when it's set; (b) add `position` as a first-class typed field with a UI control. (b) is more work but lets the user edit position from the panel. I'd recommend (a) for now and add (b) in a future story. lets go with B.
3. **Track C — `file:patch` for TSX.** The plan keeps TSX on full-regen because TSX structure is harder to patch surgically. Is that acceptable, or do we want the agent's TSX comments / formatting to survive too? If yes, that's a third PR after C. keep it as is for now.
4. **Track D — should unclassed children be visible in the layers panel?** I'd say no — they're not Scamp elements and can't be manipulated. But we could show them in a "raw" group at the bottom for visibility's sake. show as raw, its something the user should know about for debugging etc.
5. **Track E priority.** Honest read — does declaration-order shuffle bother you enough to ship a PR for it, or accept it as a known cost? In my opinion it's the smallest of the issues. i-I would go with any recommendation you have for this

Once these are answered, Track A goes first and the rest queue up behind it.
