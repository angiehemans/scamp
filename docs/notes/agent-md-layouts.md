---
title: agent.md layouts — one body, three vocabularies
related:
  - src/shared/templates/agentMd.ts
  - test/agentMdLayouts.test.ts
  - docs/notes/nextjs-sunset.md
---

# agent.md layouts — one body, three vocabularies

`agent.md` is regenerated into every project on open, so a stale
sentence is not merely wrong in this repo — it is shipped, and it is
the whole of what an agent knows before it writes a line.

The scamp-format variant used to be built like this:

```ts
export const AGENT_MD_CONTENT_SCAMP = AGENT_MD_CONTENT.replace(
  NEXT_LAYOUT_PARAGRAPH,
  SCAMP_LAYOUT_PARAGRAPH
).replace(NEXT_WRAPPER_NOTE, SCAMP_WRAPPER_NOTE);
```

Two paragraphs swapped, everything else passed through. Its doc comment
said "same conventions, framework layout", which was true of exactly
the two paragraphs it replaced. The other 34 Next.js references
survived: an agent opening a `scampjs` project was told it was "a
Next.js App Router project", pointed at `app/page.tsx`, `app/layout.tsx`
and `app/theme.css`, warned not to modify `next.config.ts`, and given a
"What NOT to change" list that protected eight files that weren't there
and none that were. The first thirty lines described the real layout,
and nothing told the reader which half was current.

`docs/plans/agent-framework-gap-report.md` has the inventory and how it
was found.

## The shape now

`buildAgentMd(v: LayoutVocabulary)` holds the shared body, and every
layout difference arrives through a field on `v`. That is the point: a
field is the ONLY way a difference can reach the document, so the next
one can't be quietly forgotten in a section nobody thought to fork.

Scalars cover the paths and commands that appear mid-sentence —
`themeCss`, `pageTsxPath`, `exampleCssImport`, `themeImportNote`. Five
sections differ too much to parameterise and arrive whole:
`structureSection`, `linkingSection`, `assetsSection`, `previewSection`,
`doNotChangeSection`. `routesSection` is a sixth that only the framework
layout has; it carries its own trailing blank line so an empty one
changes nothing, which is what keeps the Next.js output byte-identical.

Three layouts are built from it: `AGENT_MD_CONTENT` (Next.js, frozen —
see `nextjs-sunset.md`), `AGENT_MD_CONTENT_SCAMP`, and the separate
`AGENT_MD_CONTENT_LEGACY`, which predates all of this and shares
nothing.

## What the scamp variant gained

Beyond correcting the paths, two content gaps got filled, both of them
things the ecommerce-store run got wrong or had to infer:

- **`## Route files`.** `routes/` is the part of the project the agent
  owns outright, and it had four passing mentions and no example. There
  is now the file shape, the four exports and what each does, the
  segment grammar, and "compute in logic, bind in the view".
- **A data-driven image.** The assets section explained `public/` and
  stopped. Nothing said `src={product.image}` was a binding like any
  other, which is where every catalogue, gallery and card grid lands.

The TL;DR's verification bullet changed for BOTH layouts: it used to
say confirm your work with `scamp_get_element_tree`, which reports
structure only — a view that lost a binding still looks correct in it.
It now points at `scamp_check_view`. See `view-lint.md`.

## Served through MCP too

`templates/guidance.ts` slices the same document: `guidanceFor(format)`
picks the variant, `guidanceSections` splits on `##` (tracking fenced
blocks, since the guidance is full of CSS whose comments would
otherwise read as headings), and `findGuidanceSection` matches
forgivingly — exact, then normalised, then prefix, then substring, then
separators squashed so `tldr` still reaches `TL;DR`.

`scamp_get_conventions` answers from it: no argument gives the TL;DR
plus the 25 section names, and `section` gives one section. That is
~2k characters instead of ~55k, scoped to the project's actual format.
An agent that asks and one that reads the file get the same rules,
because there is one source.

`###` headings stay inside their parent on purpose: they are
subsections of one topic, and an agent asking about "HTML tags" wants
the tag-specific attributes with it.

## Keeping it honest

`test/agentMdLayouts.test.ts` asserts the scamp variant against a list
of Next-isms — the framework name, both commands, the config file, the
root layout, the token path, page file paths, `next/link`. That list is
the regression guard; it is also the thing that would have caught the
original drift, since every one of those patterns was present.

`app/` is allowed through in one shape only: a line that says there
isn't one. The test checks each occurrence sits on a "There is no" line
rather than banning the string, because saying so is useful.

When changing the shared body, check both outputs. The Next.js and
legacy variants go into real projects that are still open in Scamp, and
byte-equality is the cheap way to be sure a shared edit didn't reach
them: snapshot both before and diff after.
