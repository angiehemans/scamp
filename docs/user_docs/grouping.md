# Grouping Elements

Group selected elements into a flex container to organize your layout.

## How to group

1. Select two or more sibling elements (shift-click or marquee select).
2. Press **Cmd+G** (Mac) or **Ctrl+G** (Windows/Linux).

A new rectangle wraps the selected elements. The group:
- Becomes a **flex container** (`display: flex`, `flex-direction: row`) by default
- Uses `fit-content` for both width and height so it hugs its children
- Inherits a default gap of `8px` between children
- Is inserted at the position of the first selected element in the parent's child order

The grouped children have their `x`/`y` reset to `0` because flex layout owns their placement.

## How to ungroup

Select a group and press **Cmd+Shift+G** to ungroup. The group wrapper is removed and its children are promoted to the grandparent, preserving their order.

If the group was inside a non-flex parent, children are translated to the group's stored position so they appear roughly where the group was.

## Rules

- You can only group **siblings** — elements that share the same parent.
- You cannot group the page root.
- Groups are just regular rectangles with `display: flex`. You can change their layout, background, border, and other properties like any other element.
- Groups can be nested — group elements that are already inside a group.
- [Renaming](element-naming.md) a group works the same as any other element.

## Keyboard shortcuts

| Action | Shortcut |
|---|---|
| Group selection | **Cmd+G** / **Ctrl+G** |
| Ungroup | **Cmd+Shift+G** / **Ctrl+Shift+G** |

See [Keyboard Shortcuts](keyboard-shortcuts.md) for the full reference.
