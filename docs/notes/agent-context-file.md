---
title: Live agent context file
related:
  - src/renderer/lib/contextMarkdown.ts
  - src/renderer/src/syncBridge/contextFile.ts
  - src/main/ipc/contextOps.ts
  - src/shared/templates/agentMd.ts
---

# Live agent context file

Scamp writes `<project>/.scamp/context.md` describing the open page (or
component) and the selected element, so an agent running in the Scamp
terminal can answer "why does this element look wrong" without the user
describing what they clicked. `agent.md` tells agents to read it.

## Why `.scamp/`

Not cosmetic. Two independent mechanisms depend on the location:

- The scaffolded `.gitignore` excludes `.scamp/`, so the file is never
  committed.
- The file watcher excludes every dotfile path (`watcher.ts:56`), with a
  second defensive guard in the auto-snapshot path (`:225`).

Without the second one, Scamp writing into the project it is watching would
read as an external edit: the sync bridge would pause on every selection,
and the auto-snapshotter would capture a snapshot per click. **Moving this
file out of `.scamp/` breaks both.**

## Why it isn't deduplicated

The subscriber deliberately rewrites the file even when the content is
identical. Re-selecting the same element is a meaningful act — a user often
clicks the thing they're about to ask about — and the mtime moving is the
signal that the context is current rather than left over from earlier in the
session. Skipping no-op writes would make a deliberate re-select invisible.

## What triggers a write

`makeContextFileHandler` watches a narrow slice: the active page/component,
the project path, the active breakpoint, the selection array's identity, and
**the selected element's own object identity**.

That last one is what makes "styles changed" work without rewriting on every
unrelated edit — the store's spreads hand the edited element a new identity
and leave its siblings alone. Watching the whole `elements` map instead would
rewrite the file on any edit anywhere on the page.

Writes debounce 500ms and are fire-and-forget. `writeContextFile` swallows
its own errors: a failed context write (disk full, folder unmounted
mid-session) is never worth interrupting the user for, and the next
selection retries.

## Styles come from the generator

`buildContextMarkdown` renders the "Current styles" block with
`elementDeclarationLines` — the same function that emits the CSS module — so
the block cannot drift from what's actually on disk. `customProperties` are
filtered back out of that block and given their own section, because listing
them under "Current styles" would imply the agent could change them through
a canvas control.

One consequence worth knowing: a non-flex child always carries
`position: absolute` from the generator, so the "nothing set" fallback is
only reachable when *every* declaration on the element is a custom property.
