/**
 * Top-of-panel toggle between the typed UI view and the raw CSS editor.
 * The selection lives in the canvas store as `panelMode` so it survives
 * selection changes and re-renders without being persisted to disk.
 *
 * The Data tab is conditional:
 *   - Component editor → always shown (the user defines props there).
 *   - Page editor with a component-instance selected → shown when the
 *     instance's component declares at least one prop (Phase 6).
 *   - Page editor with anything else selected → hidden.
 */
export declare const PanelModeToggle: () => JSX.Element;
