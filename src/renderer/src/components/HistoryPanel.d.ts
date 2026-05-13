/**
 * Visual history panel — the second tab in the left sidebar.
 * Renders the active page's history list with the current cursor
 * highlighted. Clicking an entry jumps to that point in history.
 *
 * Past entries (cursor and below in time) display solid; future
 * entries (greyed out, after a divider) are the redoable steps.
 *
 * Per the story spec: clicks are dropped silently while a canvas
 * drag is in flight, so the panel is display-only during drag.
 */
export declare const HistoryPanel: () => JSX.Element;
