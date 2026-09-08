# Undo, redo, and history

Scamp tracks every change you make, so you can step backward and forward
through your edit history—one step at a time with keyboard shortcuts,
or by clicking an entry in the History panel to jump straight to that
point.

## Shortcuts

| Action | Shortcut |
|---|---|
| Undo (back one step) | **Cmd+Z** |
| Redo (forward one step) | **Cmd+Shift+Z** |
| Open the History panel | **Cmd+Shift+H** |

## The History panel

The left sidebar is an icon rail with sections for **Pages**,
**Components**, **Design System**, **History**, and **Settings**. Click
the **History** icon, or press **Cmd+Shift+H**, to see a list of every
change in the current session for the active page.

Each entry shows the following:

- A short description of the change, such as "Changed background —
  hero-card_a1b2", "Moved rect_a1b2", or "Drew rectangle".
- A relative timestamp, such as "just now" or "3 min ago". Hold the
  pointer over the entry to see the absolute time.

### Navigate history

- Click any entry to jump to that point in history. The canvas, the
  properties panel, and the underlying files all update immediately.
- Entries above the current position are in the past and appear in
  solid text. The current entry is highlighted with a left-border
  accent and a leading bullet.
- Entries below the current position are the redo stack. They appear
  dimmed, after a dashed "undone" divider. Click any of them to jump
  forward.
- A new edit while you're partway through history discards the dimmed
  entries. History is linear; there's no branching.

### Empty state

A page with no edits yet shows "No changes made in this session". The
list fills from your first action.

## What Scamp tracks

- Drawing rectangles, and adding text, images, and inputs
- Moving and resizing elements
- Changing any property—colors, sizes, spacing, borders, filters,
  shadows, and so on. Each property edit is one entry.
- Deleting, duplicating, and pasting elements
- Grouping and ungrouping
- Renaming elements, shown as "Renamed old to new"
- Adding, deleting, and renaming pages
- Commits from the CSS editor
- External file edits (see [External edits](#external-edits))

### Coalesced edits

Rapid changes to the same property of the same element within 500 ms
collapse into a single entry, so dragging a slider from `100` to `47`
doesn't create 53 entries.

Dragging a canvas element to move or resize it also commits a single
entry when you release, not one per pixel.

## Per-page history

Each page has its own independent history. Switching pages doesn't
clear anything; navigate back, and your previous edits are still there
to undo, redo, or click into.

History is session-only. It lives in memory and clears when you close
the app.

## External edits

When you or an AI agent edits a CSS or TSX file outside Scamp, the
change appears in the history as a single entry labeled **External edit
detected**. The canvas reloads to match the file.

- Press **Cmd+Z** right after an external edit to undo back to the state
  before the agent's change. Scamp rewrites the file to match that
  earlier state.
- The agent's change is preserved as a forward step, so you can redo to
  re-apply it.

This is a change from earlier versions, in which external edits cleared
the undo stack. They now compose like any other action.

## History limit

Scamp keeps up to 50 entries per page. After 50 changes on a page, Scamp
discards the oldest entries to keep memory bounded.

## Drag interactions

The History panel is display-only while you're dragging something on
the canvas—a move, a resize, or a slider. Clicks on entries are ignored
during a drag. When you release, the panel becomes interactive again,
and the drag appears as a single entry.

## Tips

- Before a risky change, glance at the History panel. The current entry
  is your known-good rollback target.
- Renaming an element updates history labels retroactively. If you
  rename `rect_a1b2` to `hero-card`, every past entry that references
  that element uses the new name.
- When you work with an AI agent, watch the History panel as edits
  arrive. Each agent change is one labeled entry that you can step back
  through if it goes wrong.
