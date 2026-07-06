# Snapshots

Snapshots are durable, point-in-time backups of your whole project —
every page and component file — saved inside the project itself. Unlike
undo history, they survive closing and reopening the app, so they're your
safety net for getting back to an earlier good state: after an external
edit went sideways, after an AI agent made a change you didn't want, or
just to bookmark a version before a risky redesign.

Snapshots live in the **History** panel, alongside your in-session undo
steps. Open it with **Cmd+Shift+H**, or click the **History** tab in the
left sidebar.

## Snapshots vs. Undo

These are two different systems that share one panel:

| | Undo / Redo | Snapshots |
|---|---|---|
| Scope | The page you're viewing | The whole project (all pages + components) |
| Lives | In memory | On disk, inside the project |
| Survives app restart? | No — session only | Yes |
| Granularity | Every edit | Coarser, point-in-time |
| How you use it | Cmd+Z / Cmd+Shift+Z, or click an entry | Click a snapshot to preview, then Restore |

In short: **undo** is for stepping through the edits you just made;
**snapshots** are for jumping back to a saved version, even one from a
previous session. See [Undo, Redo, and History](undo-redo.md) for the
undo side.

## Where snapshots are stored

Snapshots are written into a hidden `.scamp` folder inside your project,
so they **travel with the project** — copy or move the folder and the
history comes along. The `.scamp` folder is automatically excluded from
Git, so snapshots never end up in your commits.

Only your page and component files (`.tsx` and `.module.css`) are
captured. Project configuration like `theme.css`, `package.json`, and
`next.config.ts` is not part of a snapshot.

## When snapshots are taken

Scamp creates snapshots automatically at the moments that matter, plus
on demand:

| Trigger | When it happens |
|---|---|
| **Opening a project** | Captured before the canvas loads — records what changed since you last had it open. |
| **External / agent edit** | When a file is changed outside Scamp (an editor or an AI agent), the change is snapshotted as it lands. |
| **Closing** | When you close the project or quit the app. |
| **Auto-save** | About once every 2 minutes while you're actively working. |
| **Manual** | The **Save snapshot** button at the top of the History panel — you can give it a name. |
| **Before a restore** | Restoring a snapshot first snapshots your *current* state, so a restore is itself reversible. |

Snapshot-taking never interrupts you and never blocks opening, closing,
or saving — if one can't be written, Scamp simply carries on.

## The History timeline

The History panel shows a single newest-first timeline that interleaves
both systems:

- **Snapshot rows** are the durable backups above. Each shows its
  trigger or name and a relative time (hover for the exact time).
- **Undo rows** are this session's individual edits for the page you're
  viewing, shown lighter and indented between the snapshots.

Clicking an **undo row** jumps to that point on the current page
instantly — no confirmation, no file changes. Clicking a **snapshot row**
opens a preview (below). The **Now** row at the top marks your current
live state.

Two things to know about the undo rows: they're **per-page** (only the
page you're looking at) and **session-only** (they're gone after you
close the app). Snapshots from past sessions remain either way.

## Previewing before you restore

Clicking a snapshot does **not** immediately overwrite anything. Instead
it opens a **read-only preview**: Scamp loads that snapshot's version of
the current page onto the canvas and shows a banner with **Restore** and
**Exit**.

While you're previewing:

- The canvas is locked — you can't draw, move, resize, or edit text, and
  the snapshot's content can't accidentally be written to disk.
- **Exit** returns you to exactly what you were working on. Nothing was
  changed.
- **Restore** applies the snapshot (next section).

This lets you look before you leap — open a few snapshots, see which one
you want, and only then commit.

## Restoring a snapshot

Choosing **Restore** replaces the project's page and component files with
the snapshot's versions, on disk and on the canvas. A few important
details:

- **Your current state is snapshotted first**, automatically — so if you
  restore the wrong one, the version you just left is right there at the
  top of the list to restore back to.
- Restore is an **overlay**: files that were *added* after the snapshot
  was taken are left in place, not deleted. It brings back the snapshot's
  files rather than wiping everything else.
- After a restore, the in-session **undo history is cleared** — you can't
  Cmd+Z back through a restore. (The pre-restore snapshot is your way
  back instead.)

## How many are kept

Scamp keeps up to **50 snapshots per project**. Once you'd exceed that,
the oldest snapshot is removed to make room for the new one.

## Tips

- About to do something risky — a big restructure, or letting an agent
  loose on your files? Hit **Save snapshot** first and give it a name
  like "before redesign". It's the cleanest rollback point.
- Working with an AI agent? Each external edit becomes its own snapshot
  as it lands, so you can preview and restore the state from just before
  any individual change.
- Preview liberally. Opening a snapshot is non-destructive — **Exit**
  always puts you back exactly where you were.
- Snapshots are part of the project folder. To archive a known-good
  version for safekeeping, copy the whole project folder; its snapshot
  history comes with it.
