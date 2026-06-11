/**
 * The update / remove / add trio over a `ReadonlyArray<T>` field that
 * Shadows, Filters, and Transitions sections each re-implemented. The
 * list is read lazily through `getList` so the hook can be called
 * before a section's `if (!element) return null` guard (the handlers
 * only fire once the section has rendered, by which point the element
 * exists). `setList` persists the next array — typically a
 * `patchElement` call.
 *
 * `add` takes the new item rather than constructing it, since each
 * section seeds a different default. Side effects beyond the list
 * (e.g. Transitions clearing its per-row unit state on remove) stay in
 * the section as a thin wrapper around `remove`.
 */
export type ListField<T> = {
    update: (index: number, patch: Partial<T>) => void;
    remove: (index: number) => void;
    add: (item: T) => void;
};
export declare function useListField<T extends object>(getList: () => ReadonlyArray<T>, setList: (next: ReadonlyArray<T>) => void): ListField<T>;
