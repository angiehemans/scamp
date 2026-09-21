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

**3. TSX writes become edits.** *Landed.* `lib/tsxRegions.ts` finds the
regions the generator owns in a view file — the styles import, each
component import, the props type, the component itself, the `_scamp`
export — and produces the edits that make one file's owned regions say
what another's do. Each replaced region is then narrowed with
`diffText`, so a steady-state save stays line-sized rather than
function-sized. `syncBridge/tsxWrite.ts` applies the result to the file
on disk and verifies it parses to the same element map before offering
it, falling back to the generated file otherwise. Same shape as phase 2.

The plan as written here said to derive the hunks from the diff of the
generated text alone. That turns out to buy nothing: applying a full
text diff of disk against generated reproduces the generated file
exactly, which is the write we already had. Anchoring to regions is
what makes the difference, so phase 3 borrowed phase 2's approach
instead.

What a save destroyed before this, measured on a view Scamp had not
written: a comment above the component, an extra import, a
module-level constant, and an export beside the default one. All four
now survive. A JSX comment inside the tree already survived, because
`parseCode` carries it into the model and `generateCode` emits it back.

The component function stays wholly owned: a hook call or a local
variable inside it is still lost on the next save, which is what the
framework contract says. Phase 5 is what would change that.

Done: `test/e2e/save/tsx-region-writes.spec.ts` keeps all four across a
move and writes nothing at all when the markup did not change.
`test/tsxRegions.test.ts` pins region detection, import insertion and
removal, and minimality.

**Found on the way, not fixed here.** The store's `projectFormat`
starts as `nextjs`, so the write that follows opening a *legacy*
project can emit `./page.module.css` before format detection lands, and
only the next save corrects it to `./<page>.module.css`. A user who
opens a legacy project and quits without editing is left with a broken
stylesheet import. Pre-existing and unrelated to this phase, but worth
a fix of its own.

**4. Merge instead of refuse.** *Landed.* `lib/threeWayMerge.ts` diffs
both sides against the base they share and applies both sets of edits
when they do not overlap. `syncBridge/mergeWrite.ts` runs it over the
pair on a refused write — base is the version the write claimed, ours
is what it carried, theirs is what disk holds — and the conflict
handler writes the merged result instead of discarding the user's edit.
Adjacent edits are not a conflict; two insertions at the same point
are, unless they insert the same text.

Both files have to merge. Merging one and reloading the other would
leave the pair describing different designs.

The safety valve turned out to need rewriting. The plan said to parse
the merged result, but `parseCode` is deliberately lenient — it returns
a tree for `<<<<<<< not tsx` rather than throwing — so parsing proves
nothing. What it checks instead is the model: every field the design
change touched has to read back with the value it wanted, and no
element the save knew about may have disappeared. That catches the case
the per-file merges cannot see, where both files merge cleanly but the
agent deleted the element the design change is about.

It is conservative in one place worth naming: if both sides added a
child to the same parent, `childIds` reads back as neither side's
version and the merge is refused. The cost is the behaviour we had
before this phase, not a damaged file.

A merged write carries no intent of its own, so a second refusal adopts
disk rather than looping.

Done: `test/integration/writeMerge.integration.test.ts` runs the whole
loop on real files — an agent adding a `load()` above the component and
a designer resizing a box both land, an agent adding a declaration to
one rule survives the designer moving another element, and the same
declaration changed twice still refuses. `test/threeWayMerge.test.ts`
pins the merge itself.

The CSS panel's `file:patch` is still its own path. Folding it in is
worth doing once phase 5 gives the two the same anchors.

**5. Ranges from the parser.** *Landed.* The obstacle named above —
that `parseCode` rewrites the source before it parses it, so every
offset moves — is solved by making the rewrites say where things went.
`lib/sourceMap.ts` is the primitive: a rewrite returns its text plus
the regions it replaced, in both coordinate systems, and maps compose.
All three passes now report one: the named-slot hoist, the binding
hoist, and the component root's `className` normalisation. The
structural parse records a range per element, and `parseCode` maps them
back so `ParsedTree.ranges` addresses the file as written.

Ranges are not on `ScampElement`. A range describes the file and the
round-trip invariant compares designs, so they ride alongside.

`lib/tsxElementEdits.ts` uses them. Both files are parsed against the
same stylesheet, so any element that differs between them differs
because of its TSX, and the edit goes to that element's opening tag or
to the text between its tags. Everything outside the component is
still region work — the props type and the imports are not elements —
so this is phase 3's path with a finer middle. `tsxWrite` tries it
first, verifies, and falls through to the regions and then to the
generated file.

Two rules make it behave:

- **Formatting is not a change.** When every element matches, the
  component is left alone however differently it is written. This is
  what the phases before it could not do: opening a file Scamp had not
  written used to reformat the whole component on the first save.
- **Only a leaf's inside gets rewritten.** Replacing a container's
  inner range would take its children's formatting with it, which is
  the thing this exists to avoid.

It gives up — returns null, and the region path takes over — on
anything not element-shaped: an element added or removed, a reshaped
tree, a change that reaches the destructure. The last of those is
caught by verification rather than by inspection, and
`test/tsxElementEdits.test.ts` pins that: marking a text as a prop
produces an edit whose result does not read back as the save meant,
so `tsxWrite` falls through.

Done: `test/e2e/save/element-writes.spec.ts` renames one element of a
hand-formatted page and the sibling keeps its line breaks to the byte.
`test/parseRanges.test.ts` pins the ranges themselves, including
through a braced attribute, a repeat wrapper, and a component root
passthrough — the three rewrites that would otherwise drift them.

**6. Expose the stream.** *Landed.* `lib/patchLog.ts` is the session's
record of what it wrote: an ordered, bounded list of patches, each with
a monotonic revision, the target, and per file both the offsets and a
line-numbered view of every changed region.
`syncBridge/patchStream.ts` records one per save and hands out the
subscription.

What is recorded is the net effect on disk — the difference between
what was there and what the save wrote — not whichever internal path
produced it. A reader should not have to know whether a change went
through the element, region, or whole-file route.

Three readers:

- **An agent**, through the `scamp_get_recent_edits` tool. It answers
  in lines rather than offsets, because an agent has the file and not
  the version the offsets were taken against, and a hunk too large to
  hand over is truncated. Pass back the `revision` from a previous call
  to get only what followed it, which is the loop the tool is for:
  read, work, ask again before editing what you read.
- **Anyone debugging a save**, through `__scampPatches(since)`, beside
  the `__scampShadowEdits()` of phase 1.
- **A transport that does not exist yet**, through
  `patchLog.subscribe`. Multiplayer wants exactly this shape: a
  monotonic revision, and the edits between two of them.

The inbound direction already exists and is not duplicated here. An
agent's own edits arrive through the file watcher, and phase 4 merges
them.

Done: `test/e2e/save/patch-stream.spec.ts` draws on the canvas and
reads the patches back out of the running app, including paging from a
revision. `test/patchLog.test.ts` pins the log and the line numbering,
and `test/canvasSnapshot.test.ts` pins what the agent is handed.

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
