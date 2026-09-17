# Incremental writes — Plan

Status: **phases 1 and 2 landed, 2026-09-17.** Phases 3-6 not started.

Today a design change rewrites both of a target's files end to end.
This plan replaces that with an edit that touches only the lines that
changed, and makes a concurrent edit by an agent or another person
merge instead of collide.

## Why this is worth doing

The saving isn't bytes. A file is 3 KB and the write is atomic and
debounced; nobody is waiting on it.

The saving is **authority**. A whole-file write asserts that Scamp's
model is the truth for every line, including lines Scamp only
approximately understands. So every save is a chance to lose something:
a comment, a construct outside the binding grammar, an agent's edit
that landed a moment ago, formatting a person cared about. The parser
and `customProperties` work hard to make the model lossless precisely
because the write is total, and every gap in that model is a bug with a
data-loss shape.

A targeted write asserts authority only over what actually changed.
Everything else on disk survives by default rather than by effort. That
is the safety the request is really about, and it is also the
precondition for the two things named:

- **Agents.** An agent editing the same file concurrently currently
  makes Scamp pause the save and warn. With targeted edits and a merge,
  an agent's change to a route's data and a designer's change to a
  padding value can both land, because they don't touch the same lines.
- **Multiplayer.** Two designers editing different elements produce
  disjoint edits. That is only expressible if an edit is a patch
  against known positions, not a file.

## What is true today

| Piece | Where | Behaviour |
| --- | --- | --- |
| Generate | `lib/generateCode/` | Pure; whole `tsx` + `css` from the element map |
| Save | `syncBridge/writeIfDirty.ts` | Debounced; dedupes against `lastSerializedTsx/Css`; writes both files whole |
| Conflict | `writeDispatch.ts` → `main/ipc/file.ts` | Compare-and-swap: the write carries `expectedTsxContent` / `expectedCssContent` and is refused if disk differs |
| Targeted CSS | `shared/patchClass.ts`, `file:patch` | **Already surgical.** postcss replaces one class block, base or inside a `@media`, and leaves the rest byte-identical |
| Round trip | `lib/parseCode/` | `parseCode(generateCode(x)) === x`, with the invariants in `docs/notes/round-trip-contract.md` |

Two things follow. First, the compare-and-swap already tracks a base
version, which is exactly what a merge needs. Second, the CSS half of
this plan is a generalisation of something already shipped and tested,
not a new idea.

## The hard half is the TSX

A CSS module is a flat list of rules; postcss addresses one by
selector. A view file is a tree with non-local structure, and design
changes fall into three classes:

1. **Element-local.** Text, tag, an attribute, a class rename. One open
   tag, usually one line.
2. **Structural.** Add, delete, move, reparent. A contiguous subtree
   moves, and its siblings' indentation may shift.
3. **Non-local.** A binding touches the element's line, the props type,
   the destructure, and sometimes `_scamp.events`. A component instance
   adds an import. One design action, several disjoint regions.

"Rewrite the line where the change is" is exact for (1), a bounded
region for (2), and a set of disjoint regions for (3). The plan has to
handle all three or it will fall back to whole-file writes on the
changes users make most.

## How to know where a change goes

Two ways, and the order between them is the main decision.

**A. Diff two generations.** Generate as today, diff the new text
against `lastSerialized`, and apply the resulting hunks. The generator
stays the single source of truth for text, so indentation, ordering,
and the props type come out right by construction. Cheap to build.
Weakness: the patch is anchored to text Scamp generated, so if disk was
reformatted by hand the hunks won't apply and the save falls back.

**B. Ranges from the parser.** Have `parseCode` record each element's
source range, and rewrite that range directly. Anchored to what is
actually on disk, so hand formatting elsewhere is irrelevant and a file
Scamp never wrote can still be patched surgically. This is what
multiplayer needs, because a position is what two clients have to agree
on.

B is the destination. A is the stepping stone, and it is a real one:
it delivers the safety and the merge behaviour without touching the
parser.

The obstacle to doing B first is concrete. `parseCode` **rewrites the
source before it parses it**: `hoistBindings` turns `attr={expr}` into
a marker attribute and turns repeat and show wrappers into pseudo-tags,
and `hoistNamedSlots` does the same for slots. Every offset moves.
Carrying true source positions through those passes is its own project,
and it should be done deliberately rather than as a side effect of
changing the write path.

## Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| What a save produces | A list of `{ file, range, replacement }` edits, not a string | The unit the rest of this depends on. Everything else is derivation and application. |
| First derivation | Diff of generated-old against generated-new | The generator stays the one authority on text; no parser changes needed to start. |
| CSS derivation | postcss, extending `patchClassBlock` | Already shipped for the CSS panel; generalise it rather than grow a second mechanism. |
| Applying to disk | Three-way merge: base `lastSerialized`, ours the edits, theirs the file on disk | Turns most of today's conflicts into successful merges, which is the agent story. |
| Safety valve | Parse the merged result and compare it to the model before writing; fall back to a whole-file write when it disagrees | Makes the feature strictly safer than today rather than a new way to corrupt a file. |
| Still an atomic whole-file write | Yes | In-place splicing buys nothing and loses the Windows atomic-write guarantee. The *edit* is minimal; the *write* stays atomic. |
| Conflict semantics | Pause only on a true overlap | Non-overlapping drift is no longer a reason to stop. |
| Diff implementation | Decide at phase 3: a small line-differ written here, or one dependency | A line diff plus three-way apply is more than the ~20-line bar in CLAUDE.md, so it deserves an explicit call rather than a default. |

## Phases

**1. The edit type, in shadow.** *Landed.* `lib/textEdits.ts` holds
`TextEdit`, a line-granular `diffText`, a strict `applyEdits`, and
`editStats`. `syncBridge/shadowEdits.ts` runs beside every save: it
derives the edits, checks that applying them to `lastSerialized`
reproduces the generated text, and accumulates totals, which
`localStorage['scamp.debugWrites'] = '1'` prints per save and
`__scampShadowEdits()` returns. No behaviour change; the save still
writes both files whole.

What it measured, on a 14-line view with a 37-line stylesheet:

| Change | TSX | CSS |
| --- | --- | --- |
| Recolour an element | untouched | 1 hunk, 1 line |
| Resize an element | untouched | 1 hunk, 1 line |
| Edit text | 1 hunk, 1 line | untouched |
| Add an element | 1 hunk, +1 line | 1 hunk, +6 lines |
| Delete a subtree | 1 hunk, -3 lines | 1 hunk, -13 lines |
| Mark a text as a prop | 3 hunks, -2/+3 | untouched |

So the premise holds, including the awkward one: a binding is three
disjoint regions, and phase 3 has to carry them rather than widen to
the file. `test/incrementalWrites.test.ts` pins each row.

**2. CSS writes become edits.** *Landed.* `lib/cssRuleEdits.ts`
addresses a stylesheet by slot — a top-level rule, a rule inside a
`@media`, or a whole at-rule such as `@keyframes` — and produces the
changes that make one stylesheet's rules say what another's do.
`syncBridge/cssWrite.ts` applies them to the file on disk and verifies
the result parses to the same element map before offering it, falling
back to the generated file otherwise.

The case it is really for turned out to be the first save after opening
a project Scamp did not write, because `lastSerialized` is anchored to
disk on load and the canonical write then reformatted the whole file.
Three things fell out of testing against a hand-written stylesheet, and
each is now a rule the module follows:

- **Only remove what the generator owns.** A slot missing from the
  generated stylesheet is deleted only if it is a class rule or a
  `@keyframes`. A `:root`, an `@supports`, an `@font-face` that Scamp
  has no opinion about is left alone rather than treated as deleted.
- **Declaration order is not a change** while every property appears
  once, since reordering renders the same and rewriting someone's rule
  to do it is the gratuitous churn this phase exists to stop. A
  repeated property makes the comparison strict again, because order
  then decides the winner.
- **Keep the file's own whitespace.** Replacement declarations take the
  `raws.before` the rule already used, so a four-space file stays a
  four-space file.

The CSS panel's `file:patch` was left as it is. It edits one rule from
a body the user typed, which this path does not have; folding them
together is worth doing when phase 4 gives them the same merge.

Done: `test/e2e/save/css-rule-writes.spec.ts` keeps a comment, a custom
property, and an `@supports` block across a move, and leaves a
hand-written stylesheet byte-identical when nothing about the rules
changed.

**3. TSX writes become edits.** Derive hunks from the generated-text
diff, apply, verify by parsing. Done when the three change classes
above each produce a minimal diff, and when a file with a comment
between two elements keeps the comment across an unrelated change.

**4. Merge instead of refuse.** Use the three-way merge on both files.
A conflict is now only a real overlap. Done when an agent rewriting a
route's `load()` and a designer resizing a box both land, and the
`externalEdit` integration tests grow the merge cases.

**5. Ranges from the parser.** Carry source positions through the
hoisting passes, record a range per element, and derive edits directly
from the model diff instead of from generated text. Done when a
hand-formatted file takes a surgical edit without a fallback.

**6. Expose the stream.** With edits as the unit, the same patches can
feed a multiplayer session or be handed to an agent as a proposed
change. Out of scope here; phase 5 is the thing that makes it possible.

## Done when

- A single design change produces a single-hunk diff in each file it
  touches.
- A comment, an unrecognised construct, and an unrelated external edit
  all survive a save that previously overwrote them.
- Every existing round-trip and external-edit test still passes, plus
  new ones asserting the patched file parses back to the same model.
- The fallback is observable: when a merge or a verify fails, the save
  still lands as a whole-file write and says so in the log.

## Risks, and what would change my mind

- **A patch that is valid but wrong.** The merged text parses, but into
  a different model than intended, because an agent renamed something
  the patch still refers to. The verify step catches the mismatch; the
  fallback makes it a whole-file write rather than corruption.
- **Fallback becomes the common case.** If real projects are
  reformatted often enough that hunks rarely apply, phase 3 buys little
  and phase 5 becomes urgent rather than optional. Phase 1's shadow
  assertion measures this before any behaviour changes, which is the
  main reason it exists.
- **Two mechanisms for longer than intended.** If phase 2 ships and
  phase 3 stalls, CSS is surgical and TSX is not, which is a confusing
  half-state to explain. They should land in the same release.
- **The round-trip invariant loosens.** Today `generateCode` output is
  the only thing `parseCode` must read. Surgical edits mean the file on
  disk may be text Scamp never generated, so the parser's tolerance
  becomes load-bearing in a new way. `docs/notes/round-trip-contract.md`
  needs a section on that before phase 3 lands.
