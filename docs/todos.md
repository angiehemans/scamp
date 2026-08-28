# Scamp — Known issues and follow-ups

Small, specific things that are understood but not fixed. Each entry says
what is wrong, why it was left, and what a fix has to deal with — so
picking one up does not mean rediscovering it.

---

## 1. The duplicate-declaration indicator misses duplicates that change nothing

**Status:** confirmed, not fixed. Found 2026-08-28.

### What is wrong

The properties panel shows a dot on a section when the parser saw the same
CSS property declared twice in an element's class block. It does not appear
when the duplicate leaves the winning value unchanged.

Reproduce by appending to an element's block a declaration it already has,
with the same value the block already ends on — for example a second
`height` before the generator's own `height`. The file genuinely has two
`height` declarations. No dot appears.

That is the case where the warning is most useful: a duplicate that changes
nothing is pure dead weight, and the user has no other signal it is there.
A duplicate that DOES change the outcome at least shows up as a different
rendering.

### Why it happens

`src/renderer/src/syncBridge/externalEdit.ts` skips the reload when the
parsed tree regenerates to the same code it already has:

```ts
if (currentCode.tsx === nextCode.tsx && currentCode.css === nextCode.css) {
  return;
}
```

That is right for the element tree — there is nothing to reload. But
`cssDuplicates` is not part of the tree. It describes the file's raw text,
and a duplicate whose winner is unchanged regenerates identically, so the
bail throws the new duplicate information away.

### What a fix has to deal with

Two attempts failed on the same day, both in the sync bridge:

1. **A plain `setCssDuplicates` store action.** The store subscription in
   `storeSubscription.ts` treats any un-flagged store write as a genuine
   canvas edit — it calls `markUnsaved()` and schedules a write. Updating
   duplicates made the app think the user had edited the document during an
   external-edit quiet window, and the save status ended at
   `reloaded-from-disk`.

2. **The same action flagged as a load** (`isLoading: true`,
   `lastLoadKind: 'external'`, mirroring `reloadElements`). The subscriber
   ignores loads, which fixed the first problem — and then swallowed the
   user's *next* edit, so a size change never reached disk.

So the real work is in the load-flag lifecycle, not in the duplicate
tracking itself. `findDuplicateDeclProps` already reports this correctly;
the information is computed and then discarded.

A fix should also add the case to
`test/e2e/properties-panel/duplicate-indicator.spec.ts`. That spec
currently injects its duplicates at the END of the class block so they win,
which sidesteps the bug — deliberately, and noted in the spec.

### Related

- `docs/notes/default-omission-and-size.md` — the generator change that
  exposed this, by making a drawn element's winning size stable.
