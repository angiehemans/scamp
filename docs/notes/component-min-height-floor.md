# Component min-height floor

The page-root default carries `min-height: 100vh` (`DEFAULT_ROOT_STYLES`
in `src/renderer/lib/defaults.ts`) so a generated **page** has visible
height in any browser — absolutely-positioned children don't contribute
to the root's box, so without a floor the page collapses to 0px.

A **component** must NOT inherit that floor. Components are embedded
inside a page, not full pages themselves, so a `100vh` min-height blows
out their layout in the canvas preview, `next dev`, and on live sites.

## What enforces it

- `DEFAULT_COMPONENT_ROOT_STYLES` (`defaults.ts`) = `DEFAULT_ROOT_STYLES`
  but with `minHeight: undefined`.
- `parseCode` takes `isComponent` (in `ParseCodeOptions`). For a
  component root it (a) uses `DEFAULT_COMPONENT_ROOT_STYLES` as the
  baseline so the floor is never seeded when the CSS omits `min-height`,
  and (b) strips an inherited `min-height: 100vh` from the root's
  declarations (`stripComponentRootMinHeightFloor`) so older components
  scaffolded with the floor stop round-tripping it back into the file.
- `generateCode` needs no special case: it emits `min-height` purely
  from `el.minHeight`, which is now `undefined` for component roots.
- The "Add Component" scaffold (`DEFAULT_COMPONENT_CSS` in
  `src/main/ipc/componentOps.ts`) no longer writes `min-height: 100vh`.

## Self-heal

Stripping happens on parse, so an existing component's in-memory state
loses the floor on load. The next save writes the cleaned CSS via the
existing silent canonical-migration path in
`src/renderer/src/syncBridge/storeSubscription.ts` (initial-load,
non-external). External agent edits are NOT auto-rewritten — they heal
on the next user-driven save instead. No `migrated` flag is set: that
flag drives the page-sizing migration banner, which is unrelated.

## Consistency requirement

Every `parseCode` call that can target a component must pass
`isComponent` (mirroring the existing `generateCode` calls). If one path
re-seeds the floor while another strips it, the canvas and disk oscillate
(echo loop). Current component-aware call sites: `useActiveTarget`,
`useProjectStoreSync`, and the syncBridge `externalEdit` / `divergence` /
`writeIfDirty` reload paths (all keyed on `target.kind === 'component'`).

An explicit, non-`100vh` `min-height` the user sets on a component root is
preserved — only the inherited viewport floor is removed.
