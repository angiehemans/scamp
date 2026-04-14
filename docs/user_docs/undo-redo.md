# Undo and Redo

Scamp tracks your changes so you can step backward and forward through your edit history.

## Shortcuts

| Action | Shortcut |
|---|---|
| Undo | **Cmd+Z** |
| Redo | **Cmd+Shift+Z** |

## What Is Tracked

- Adding, removing, and duplicating elements
- Moving and resizing elements
- Changing properties (colors, sizes, spacing, borders, etc.)
- Renaming elements

## History Limit

Scamp keeps up to **50 steps** of undo history. Once you exceed 50 changes, the oldest entries are discarded.

## When History Clears

The undo history resets in two situations:

- **External file edits** -- When Scamp detects that a file was modified outside the app (see [Bidirectional Sync](bidirectional-sync.md)), the history clears because the external change may conflict with stored undo states.
- **Page switches** -- Navigating to a different page clears the history for the previous page.

## Tips

- If you are about to make a risky change, consider duplicating the element first (**Cmd+D**) as a manual backup.
- When collaborating with an AI agent, be aware that each external edit clears your undo stack.
