# Start Screen Redesign — Plan

**Status:** Approved.
**Date:** 2026-04-09

## Goal

Replace the centered 480px card start screen with a full-window sidebar +
main area layout. The sidebar holds navigation/actions, the main area shows
recent projects, and a modal handles project creation. The layout fills the
entire window to leave room for future additions.

---

## Layout

### Sidebar (~240px, left)

- **Top**: "Scamp" title, "Local design tool — draw, get real code." subtitle
- **Middle**: "New Project" primary button (opens modal), "Open Project"
  secondary button. Stacked vertically, full-width.
- **Bottom** (pushed down via flex spacer): default folder path display,
  Change and Clear links. Same styling as current `defaultFolderRow` but
  vertical to fit the narrow sidebar.

### Main area (fills remaining width)

- "Recent Projects" heading at top.
- Scrollable list of recent projects filling the available height. Each
  item: project name, path, remove button. Missing-folder items greyed
  out with "Folder not found" label. Same data and behavior as today.
- Empty state: "No recent projects yet." centered in the area.

### Create project modal

- Triggered by the "New Project" sidebar button.
- Semi-transparent dark backdrop (`rgba(0,0,0,0.5)`).
- Centered card (~400px wide, dark bg `#232323`, rounded corners, shadow).
- Contents: "New Project" heading, project name input with auto-suggest on
  blur, path hint showing `defaultFolder/<name>`, error display, Cancel +
  Create buttons.
- Escape key or clicking the backdrop closes the modal.
- Same `handleSubmitCreate` / `validateProjectName` / `suggestProjectName`
  logic — just moved into the modal.

### First-run state (no default folder set)

Same sidebar + main layout, but:
- Main area shows a welcome message: "Welcome to Scamp — pick a default
  folder where new projects will live." plus a "Choose Folder" button.
- Sidebar "New Project" button is disabled.
- Once a folder is chosen, the main area switches to the recent projects
  list.

---

## Components

| Component | Change |
|---|---|
| `StartScreen.tsx` | Rewrite: full-window flex layout with sidebar + main area. Manages `createMode` state, renders `CreateProjectModal` when active. |
| `CreateProjectModal.tsx` | New: modal dialog with backdrop, name input, path hint, create/cancel. Receives `defaultFolder`, `onSubmit`, `onCancel` as props. |
| `StartScreen.module.css` | Rewrite: new layout classes (`.screen`, `.sidebar`, `.main`, `.sidebarTitle`, `.sidebarActions`, `.sidebarFooter`, `.recentList`, `.emptyState`, `.welcomeState`). |
| `CreateProjectModal.module.css` | New: `.backdrop`, `.dialog`, `.dialogTitle`, `.dialogInput`, `.dialogHint`, `.dialogActions`. |

No IPC changes, no store changes, no new dependencies.

---

## Implementation steps

1. Create `CreateProjectModal.tsx` + `CreateProjectModal.module.css` — the
   modal component with name input, validation, path hint, create/cancel.
2. Rewrite `StartScreen.module.css` — new full-window layout with sidebar
   and main area.
3. Rewrite `StartScreen.tsx` — sidebar + main area layout, conditionally
   render `CreateProjectModal`, first-run welcome state in main area.
4. Verify typecheck and build.

---

## Styling notes

- Dark theme consistent with the rest of the app: `#1a1a1a` backgrounds,
  `#2c2c2c` borders, `#e6e6e6` text, `#3b82f6` primary buttons.
- Sidebar background slightly lighter (`#1f1f1f`) with a right border
  (`1px solid #2c2c2c`) to separate it from the main area.
- Main area background `#141414` — slightly darker than sidebar for
  visual depth.
- Modal backdrop `rgba(0,0,0,0.5)`, dialog card `#232323` with shadow.
- All fonts use the app's `'Ubuntu Mono', monospace` via inheritance.
