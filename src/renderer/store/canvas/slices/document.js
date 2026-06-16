import { ROOT_ELEMENT_ID, } from '@lib/element';
import { useHistoryStore } from '../../historySlice';
import { makeRootElement, } from '../factories';
export const createDocumentSlice = (set) => ({
    activePage: null,
    activeComponent: null,
    pageSource: null,
    isLoading: false,
    lastLoadKind: null,
    cssDuplicates: {},
    pageCustomMediaBlocks: [],
    pageKeyframesBlocks: [],
    componentTrees: {},
    loadPage: (page, elements, source, customMediaBlocks, keyframesBlocks, cssDuplicates) => {
        set((state) => ({
            activePage: page,
            // Mutually exclusive with activeComponent — leaving the
            // previous component reference in place while editing a
            // page would confuse the sync bridge about which file pair
            // to write back to.
            activeComponent: null,
            elements,
            pageSource: source,
            pageCustomMediaBlocks: customMediaBlocks ?? [],
            pageKeyframesBlocks: keyframesBlocks ?? [],
            cssDuplicates: cssDuplicates ?? {},
            selectedElementIds: [],
            isLoading: true,
            lastLoadKind: 'initial',
            // Data tab is component-only; fall back when leaving a component.
            panelMode: state.panelMode === 'data' ? 'ui' : state.panelMode,
        }));
        useHistoryStore.getState().setActivePageId(page.tsxPath);
        // Seed the history bucket so Cmd+Z can return to this state.
        useHistoryStore.getState().commitInitialIfEmpty(elements);
    },
    loadComponent: (component, elements, source, customMediaBlocks, keyframesBlocks, cssDuplicates) => {
        set({
            activeComponent: component,
            // Same mutual-exclusivity rule as loadPage. We don't carry
            // a "returnTo page" in store state for Phase 2 — the
            // ProjectShell tracks the entry-point page in its own
            // React state since that's a UI concern.
            activePage: null,
            elements,
            pageSource: source,
            pageCustomMediaBlocks: customMediaBlocks ?? [],
            pageKeyframesBlocks: keyframesBlocks ?? [],
            cssDuplicates: cssDuplicates ?? {},
            selectedElementIds: [],
            isLoading: true,
            lastLoadKind: 'initial',
        });
        // Components get their own per-target history bucket keyed by
        // their tsxPath — same shape as pages so the history slice
        // doesn't need component-aware code.
        useHistoryStore.getState().setActivePageId(component.tsxPath);
        useHistoryStore.getState().commitInitialIfEmpty(elements);
    },
    reloadElements: (elements, source, customMediaBlocks, keyframesBlocks, cssDuplicates) => {
        set((state) => ({
            elements,
            pageSource: source,
            pageCustomMediaBlocks: customMediaBlocks ?? state.pageCustomMediaBlocks,
            pageKeyframesBlocks: keyframesBlocks ?? state.pageKeyframesBlocks,
            cssDuplicates: cssDuplicates ?? state.cssDuplicates,
            // Drop any selection that no longer exists in the new tree (the file
            // could have been edited externally to remove an element).
            selectedElementIds: state.selectedElementIds.filter((id) => id in elements),
            isLoading: true,
            lastLoadKind: 'external',
        }));
        // syncBridge is responsible for pushing the `external-edit`
        // history entry (it calls enqueueExternalEdit AFTER reloadElements
        // settles); we don't push from here so initial-format-migration
        // reloads don't pollute the history.
    },
    setPageSource: (source) => set({ pageSource: source }),
    setComponentTrees: (trees) => set({ componentTrees: trees }),
    resetForNewPage: () => set({
        elements: { [ROOT_ELEMENT_ID]: makeRootElement() },
        selectedElementIds: [],
        editingElementId: null,
        activePage: null,
        activeComponent: null,
        pageSource: null,
        isLoading: false,
        // Drop the manual zoom too — we want a fresh project to start in
        // fit-to-container mode regardless of the previous session.
        userZoom: null,
    }),
});
