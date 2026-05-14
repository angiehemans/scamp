# Undo, Redo, and History

Scamp tracks every change you make so you can step backward and
forward through your edit history — either one step at a time
with keyboard shortcuts, or by clicking any entry in the History
panel to jump straight to that point.

## Shortcuts

| Action | Shortcut |
|---|---|
| Undo (back one step) | **Cmd+Z** |
| Redo (forward one step) | **Cmd+Shift+Z** |
| Toggle History tab | **Cmd+Shift+H** |

## The History Panel

The left sidebar has two tabs: **Pages & Layers** (default) and
**History**. Click the History tab — or press **Cmd+Shift+H** — to
see a list of every change in the current session for the active
page.

Each entry shows:

- A short description of the change (e.g. "Changed background —
  hero-card_a1b2", "Moved rect_a1b2", "Drew rectangle").
- A relative timestamp ("just now", "3 min ago"). Hover the entry
  for the absolute time.

### Navigating

- **Click any entry** to jump straight to that point in history.
  The canvas, properties panel, and underlying files all update
  immediately.
- Entries above the current cursor are in the past (solid text);
  the **current** entry is highlighted with a left-border accent
  and a leading bullet.
- Entries below the current cursor are the redo stack (greyed
  out, after a dashed "undone" divider). Click any of them to
  jump forward.
- A new edit while you're mid-history discards the greyed-out
  entries — standard linear history, no branching.

### Empty state

A page with no edits yet shows "No changes made in this session".
The list populates from your first action.

## What Is Tracked

- Drawing rectangles, adding text, adding images, adding inputs
- Moving and resizing elements
- Changing any property (colors, sizes, spacing, borders,
  filters, shadows, etc.) — each property edit becomes one entry
- Deleting, duplicating, and pasting elements
- Grouping and ungrouping
- Renaming elements (shown as "Renamed old to new")
- Adding, deleting, and renaming pages
- Raw-CSS-panel commits
- External file edits (see *External edits* below)

### Coalesced edits

Rapid same-element / same-property changes within 500 ms collapse
into a single entry — dragging a slider from `100` to `47` doesn't
create 53 history entries.

Dragging a canvas element (move or resize) also commits a single
entry on mouseup, not one per pixel.

## Per-Page History

Each page has its own independent history. Switching pages doesn't
clear anything — navigate back and your previous edits are still
there to undo, redo, or click into.

History is **session-only**: it lives in memory and clears when
you close the app.

## External Edits

When you (or an AI agent) edit a CSS or TSX file outside Scamp,
the change appears in the history as a single entry labeled
**"External edit detected"**. The canvas reloads to match the
file.

- **Cmd+Z right after an external edit** undoes back to the
  state before the agent's change. The file is rewritten to match
  that earlier state.
- The agent's change is preserved as a forward step — you can
  redo to re-apply it.

This is a behaviour change from earlier versions: external edits
used to wipe the undo stack. They now compose like any other
action.

## History Limit

Scamp keeps up to **50 entries per page** of history. Once you
exceed 50 changes on a page, the oldest entries are discarded
to keep memory bounded.

## Drag Interactions

The History panel is display-only while you're actively dragging
something on the canvas (a move, a resize, a slider). Clicks on
history entries are ignored mid-drag. Once you release, the
panel becomes interactive again — and the drag itself shows up
as a single entry.

## Tips

- For a risky change, glance at the History panel beforehand:
  the current cursor entry is your "known good" rollback target.
- Element renames update history entry labels retroactively. If
  you rename `rect_a1b2` to `hero-card`, every past entry
  referencing that element re-labels to use the new name.
- Working with an AI agent? Watch the History panel as edits
  arrive — each agent change is one labelled entry you can step
  back through if it goes sideways.
