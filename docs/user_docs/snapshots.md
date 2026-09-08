# Snapshots

Snapshots are durable, point-in-time backups of your whole project—every
page and component file—saved inside the project itself. Unlike undo
history, they survive closing and reopening the app, so they're your
safety net for getting back to an earlier good state: after an external
edit went wrong, after an AI agent made a change you didn't want, or to
bookmark a version before a risky redesign.

Snapshots live in the **History** panel, alongside your in-session undo
steps. To open the panel, press **Cmd+Shift+H**, or click the
**History** icon in the left sidebar rail.

## Snapshots versus undo

The two systems share one panel:

| | Undo and redo | Snapshots |
|---|---|---|
| Scope | The page you're viewing | The whole project (all pages and components) |
| Storage | In memory | On disk, inside the project |
| Survives an app restart | No; session only | Yes |
| Granularity | Every edit | Coarser; point in time |
| How you use it | **Cmd+Z** and **Cmd+Shift+Z**, or click an entry | Click a snapshot to preview it, then click **Restore** |

In short, undo steps through the edits you just made, and snapshots jump
back to a saved version, even one from a previous session. For the undo
side, see [Undo, redo, and history](undo-redo.md).

## Where snapshots are stored

Scamp writes snapshots to a hidden `.scamp` folder inside your project,
so they travel with the project: copy or move the folder, and the
history comes along. The `.scamp` folder is excluded from Git
automatically, so snapshots never end up in your commits.

Snapshots capture only your page and component files (`.tsx` and
`.module.css`). Project configuration such as `theme.css`,
`package.json`, and `next.config.ts` isn't part of a snapshot.

## When Scamp takes snapshots

Scamp creates snapshots automatically at the moments that matter, and
on demand:

| Trigger | When it happens |
|---|---|
| **Opening a project** | Before the canvas loads. Records what changed since you last had the project open. |
| **External or agent edit** | When a file changes outside Scamp, in an editor or by an AI agent. The change is captured as it lands. |
| **Closing** | When you close the project or quit the app. |
| **Auto-save** | About every 2 minutes while you're working. |
| **Manual** | The **Save snapshot** button at the top of the History panel. You can give the snapshot a name. |
| **Before a restore** | Restoring a snapshot first snapshots your current state, so a restore is itself reversible. |

Taking a snapshot never interrupts you and never blocks opening,
closing, or saving. If a snapshot can't be written, Scamp carries on.

## The History timeline

The History panel shows a single newest-first timeline that interleaves
both systems:

- **Snapshot rows** are the durable backups. Each shows its trigger or
  name and a relative time. Hold the pointer over a row for the exact
  time.
- **Undo rows** are this session's individual edits for the page you're
  viewing, shown lighter and indented between the snapshots.

Clicking an undo row jumps to that point on the current page
immediately, with no confirmation and no file changes. Clicking a
snapshot row opens a preview (see the next section). The **Now** row at
the top marks your current live state.

Undo rows are per page (only the page you're looking at) and session
only (gone after you close the app). Snapshots from past sessions remain
either way.

## Preview before you restore

Clicking a snapshot doesn't overwrite anything. It opens a read-only
preview: Scamp loads that snapshot's version of the current page onto
the canvas and shows a banner with **Restore** and **Exit**.

While you preview a snapshot:

- The canvas is locked. You can't draw, move, resize, or edit text, and
  the snapshot's content can't be written to disk by accident.
- **Exit** returns you to exactly what you were working on. Nothing
  changed.
- **Restore** applies the snapshot (see the next section).

You can open several snapshots, see which one you want, and only then
commit.

## Restore a snapshot

Clicking **Restore** replaces the project's page and component files with
the snapshot's versions, on disk and on the canvas. Keep the following in
mind:

- Scamp snapshots your current state first, automatically. If you
  restore the wrong one, the version you just left is at the top of the
  list, ready to restore.
- Restore is an overlay. Files added after the snapshot was taken stay in
  place; they aren't deleted. Restore brings back the snapshot's files
  rather than wiping everything else.
- After a restore, the in-session undo history is cleared. You can't
  press **Cmd+Z** to step back through a restore; the pre-restore
  snapshot is your way back instead.

## How many snapshots Scamp keeps

Scamp keeps up to 50 snapshots per project. When a new snapshot would
exceed that, Scamp removes the oldest one to make room.

## Tips

- Before something risky—a big restructure, or letting an agent loose on
  your files—click **Save snapshot** and give it a name like "before
  redesign". It's the cleanest rollback point.
- When you work with an AI agent, each external edit becomes its own
  snapshot as it lands, so you can preview and restore the state from
  just before any individual change.
- Preview freely. Opening a snapshot is non-destructive; **Exit** always
  puts you back exactly where you were.
- Snapshots are part of the project folder. To archive a known-good
  version, copy the whole project folder; its snapshot history comes
  with it.
