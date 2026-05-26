# docs/notes/

Long-form context that would otherwise live as multi-paragraph inline comments. Code stays short; the reasoning lives here.

## When to add a note

Add a note when the explanation is more than ~2 lines, spans multiple files, or captures an incident that shaped the design. One-liners like `// stays null because chokidar lowercases on macOS` stay in the code — pull-mode warnings are most valuable next to the line they protect.

## Naming + structure

- Kebab-case filenames, topic-scoped: `components-sync.md`, `pending-write-tracker.md`.
- Frontmatter required:
  ```
  ---
  title: <Short title>
  related: [src/path/to/file.ts, src/path/to/other.ts]
  ---
  ```
- Body is free-form Markdown. Start with the "what's surprising here" sentence; explain the why; finish with the gotchas.

## Cross-referencing

Inline comments that point at a note use a single-line form so they don't bloat the code:

```ts
// see docs/notes/components-sync.md — target-swap suppression
armTargetSwapSuppression();
```

The reference is a contract: if the note moves or is deleted, every pointer to it needs updating. Use grep before renaming a note.

## Maintenance

- Stale notes are worse than no notes. When code that a note documents changes meaningfully, update the note in the same commit.
- If a note hasn't been touched in a year AND its `related:` files have all churned, audit whether it still describes reality. Prefer deletion over drift.
- Notes are for explanation, not for tracking work. Plans live in `docs/plans/`; backlogs in `docs/backlog-*.md`; this folder is reference material.
