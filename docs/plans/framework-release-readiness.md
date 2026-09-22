# Framework release readiness — gaps and fixes

Written 2026-09-22, from a read of the branch `fix/img-binding-decode`
against what a release that makes the Scamp framework (`scampjs`) the
primary format has to be able to claim.

The five items from `agent-framework-gap-report.md` are done. This is
what a second pass found once they were: three real gaps, two recorded
flakes, and the state of the branch itself.

Short version: the only thing that would stop a tag is that **the e2e
suite has never been run against the scamp format as a whole**, and
there is no CI that would have noticed. The rest is small.

---

## 1. The scamp format has no end-to-end coverage as a whole

**Status: fixing.**

`test/e2e/fixtures/project.ts` defaults a test project to `legacy`:

```ts
const format = opts.format ?? (envFormat === 'nextjs' || envFormat === 'scamp' ? envFormat : 'legacy');
```

So the scamp path runs only where a spec sets `format: 'scamp'`
explicitly, or under `SCAMP_E2E_FORMAT=scamp`. And
`.github/workflows/release.yml` runs no tests at all — it installs,
builds, and publishes. There is no workflow that runs Playwright, so
nothing has ever exercised the format this release is about.

This is not theoretical. `framework-phase-5-plan.md` records that
running just the **canvas** specs under `SCAMP_E2E_FORMAT=scamp` found
four failures, all with one cause: a view kept the component artboard
instead of the page canvas. That was one folder out of thirty.

**The fix:** run the suite under the flag, triage what falls out, and
record the result here. Anything found gets fixed or written down.

**Note on method:** an e2e run measures `out/`, built by
`electron-vite build`, which resolves `.js` shims over `.ts` exactly as
the dev server does. `npx tsc --build tsconfig.web.json --force`
has to precede `npm run build`, or the run measures the last shim
regeneration rather than the current source. The bundle hash printed by
the build is the tell: unchanged hash means unchanged code.

---

## 2. An image can't be bound to data from the UI

**Status: fixing.**

`TAG_ATTRIBUTES` in `lib/elementTags.ts` has entries for `video`,
`iframe`, `input`, `button`, `form`, `label`, `blockquote`, `time`,
`dialog`, `textarea` — and none for `img`.

The Data tab's `attributeCandidates` builds its list from the typed
attributes for the tag, plus `a`'s link attributes, plus whatever is
present in the attribute bag, plus whatever is already bound. For an
`<img>` all four are empty: there is no `img` entry, `src` and `alt`
are typed fields rather than bag entries, and an unbound image has no
bindings yet. So the Data tab offers **nothing** to bind.

An agent writing the file can create `src={product.image}`, and since
the parser fix (`5d5c574`) that now works end to end. A designer
cannot. Shipping "images can be data-driven" in a release where only
agents can make one is the wrong shape.

**The fix is not to add `img` to `TAG_ATTRIBUTES`** — `ElementSection`
renders an input per entry, so that would put a second Src and Alt
field in the Element section, duplicating the ones the Image section
already owns. Bindability and panel-rendering are different questions
for this tag, so they need different lists.

---

## 3. Regenerating a file rewrites `&` as `&amp;`

**Status: fixing.**

`escapeHtml` escapes `&` in every attribute value and text body. An
agent writes:

```tsx
<img src="https://images.unsplash.com/photo-1441986300917?w=2000&q=80" />
```

and the next canvas save rewrites it to `&amp;q=80`. JSX decodes the
entity, so the rendered result is identical and the round-trip is
stable — it does not compound across saves. But in a tool whose whole
premise is bidirectional sync with files a human and an agent both
edit, a save that dirties lines nobody touched is worse than cosmetic.

Nothing is lost by stopping. The parser decodes entities on the way in
either way, so a literal `&amp;` in the source already arrives as `&`;
not re-escaping on the way out makes the file *more* faithful to what
was written, not less. `<`, `>` and `"` still have to be escaped.

---

## 4. Two recorded flakes

**Status: recorded, with a better lead than "flaky".**

`docs/todos.md` #2 has `canvas/draw-into-flex.spec.ts` failing once
under parallel load. The auth loopback specs joined it during this
branch's work, and chasing them produced something more useful than
"flaky": the failure reproduced 3 times out of 3 in a window
immediately after a full `npm run test`, then stopped and has passed
every run since. The two files use non-overlapping port ranges and each
already carries a comment describing a previous fix for this same
flake, so a third speculative fix without a live repro would be
guesswork. `docs/todos.md` #2 now records how to re-open the window —
run the full suite, then immediately loop the two auth files — which is
the part that was missing.

---

## 5. The branch is unmerged and mostly undriven

**Status: for Angie.**

Nine commits on `fix/img-binding-decode`. The image fixes have been
exercised in the real app. These have not:

- the `<img>` binding parser fix — needs the six product images
  confirmed on the canvas in `ecommerce-store`
- `scamp_check_view` and `scamp_get_conventions` — need one real call
  each from a Claude Code session in the Scamp terminal
- the regenerated `agent.md` — cheapest to check and highest
  consequence, since it rewrites into every project on open

`ecommerce-store`'s Product view also still has unsaved canvas state on
`.product_img_a9a6` (`position: absolute; left: 0; top: 0`, not in the
CSS module) that predates this work. Decide whether to keep or discard
it before saving, so it isn't read as part of the fix.

---

## Not blockers

- **The Next.js path.** Frozen but first-class and tested, per
  `nextjs-sunset.md`. Its removal criteria are explicitly about a later
  release: the migration offered for several releases, and telemetry
  showing Next.js projects at a negligible share of opens.
- **Framework phases.** 1 through 4 are all marked implemented in their
  plans. Phase 5 is further adapters (Node, Vercel, Netlify), scoped as
  demand shows.
- **Sentry in development.** `enabled` follows the user's opt-in, not
  the build type, so a dev session transmits — tagged `environment:
  development`, so it is filterable. Working as designed; a decision to
  revisit rather than a gap.
- **The Linux GPU console noise** (`vaInitialize`,
  `GetVSyncParametersIfAvailable`). Expected under the forced X11
  backend, see `linux-wayland-ozone.md`.
