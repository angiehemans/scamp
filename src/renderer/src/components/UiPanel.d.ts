/**
 * The typed view of the properties panel. Reads the primary selected
 * element from the store and renders the sections that apply to its
 * element type. Root is treated like a regular rectangle — it just
 * has no parent, so Position is hidden.
 *
 * Each section is its own small component that reads its own slice of
 * the store and writes via `patchElement`. The UI panel is a thin
 * orchestrator with no edit logic of its own.
 */
export declare const UiPanel: () => JSX.Element;
