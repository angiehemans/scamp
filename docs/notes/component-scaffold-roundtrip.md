# Component scaffold must round-trip through generateCode

## The bug it fixes

The "Add Component" flow used to write a minimal scaffold to disk:

```css
/* Card.module.css */
.root {
}
```

```tsx
// Card.tsx
<div data-scamp-id="root" className={styles.root}>
</div>
```

That scaffold does NOT round-trip cleanly through
`parseCode → generateCode`. `parseCode` applies the component-root
baseline (`DEFAULT_COMPONENT_ROOT_STYLES`: stretch width, relative
position, and — unlike a page root — NO `100vh` floor; see
docs/notes/component-min-height-floor.md), and `generateCode` then emits
those defaults explicitly. The TSX shape also collapses to a self-closing
`<div ... />` because the root has no children. So the regenerated
form looks like:

```css
.root {
  width: 100%;
  position: relative;
}
```

```tsx
<div data-scamp-id="root" className={styles.root} />
```

After `loadComponent` opened the new component, the syncBridge's
`isLoading` branch ran canonical migration and dispatched a write
of the regenerated form, updating `lastSerialized` to the canonical
content. ~200ms later chokidar's `add` event fired for the
original raw scaffold and arrived at the renderer. The echo guard
(`payload === lastSerialized`) failed because `lastSerialized` had
already been advanced to the canonical form. The chokidar handler
then opened a quiet window and called `state.reloadElements`,
which wiped any element the user had drawn in the meantime — the
exact race that broke `group-inside-component.spec.ts:11` and
both `css-edits-in-component` specs.

## The fix

Two defences in `src/main/ipc/componentOps.ts`:

1. **The scaffold matches the canonical regen.** `defaultComponentTsx`
   emits the self-closing form and `DEFAULT_COMPONENT_CSS` includes
   the root defaults. A round-trip through parseCode / generateCode
   reproduces the file byte-for-byte, so the renderer's canonical
   migration is a no-op and `lastSerialized` stays aligned with disk.
2. **Chokidar suppression on the initial write.** The renderer
   already has the content via the IPC return value; broadcasting
   a `file:changed` is pure noise that would only race the user's
   first interaction. `createComponent` now registers both paths in
   the pending-write tracker with `suppressChanged: true`, same as
   `handleWrite` in `file.ts`.

Either fix alone would close the race. Keeping both means a future
defaults change that breaks round-trip stability for component
roots won't immediately re-open the window.

## When to revisit

If `DEFAULT_COMPONENT_ROOT_STYLES` ever changes, `DEFAULT_COMPONENT_CSS`
here has to track it — otherwise the canonical-migration write fires
again and we're one chokidar-suppression bug away from the same
race. There's no automated check; the round-trip test in
`test/component-scaffold-roundtrip.test.ts` is the closest thing.

The "long-term" cleanup this note used to defer is now done: components
no longer inherit the page-root `min-height: 100vh` floor. A dedicated
`DEFAULT_COMPONENT_ROOT_STYLES` is plumbed through parseCode /
generateCode via `isComponent`. See
docs/notes/component-min-height-floor.md for that mechanism (including
the self-heal that strips the floor from already-scaffolded components).
