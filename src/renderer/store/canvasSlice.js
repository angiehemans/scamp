import { create } from 'zustand';
import { temporal } from 'zundo';
import { cloneElementSubtree, generateElementId, groupSiblings, reorderElementPure, ROOT_ELEMENT_ID, ungroupSiblings, } from '@lib/element';
import { PRESETS_BY_NAME, isPresetName } from '@lib/animationPresets';
import { DEFAULT_RECT_STYLES, DEFAULT_ROOT_STYLES } from '@lib/defaults';
import { DEFAULT_BREAKPOINTS, } from '@shared/types';
/**
 * Discrete zoom levels for the canvas. Pressing Cmd/Ctrl+= and Cmd/Ctrl+-
 * walks through this list. Cmd/Ctrl+0 clears the explicit zoom and falls
 * back to "fit-to-container".
 */
export const ZOOM_STEPS = [
    0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4,
];
const makeRootElement = () => ({
    ...DEFAULT_ROOT_STYLES,
    id: ROOT_ELEMENT_ID,
    type: 'rectangle',
    parentId: null,
    childIds: [],
    widthMode: 'fixed',
    heightMode: 'fixed',
    x: 0,
    y: 0,
    customProperties: {},
});
/**
 * Default fill color for any rectangle created via the canvas tool. We
 * deliberately override `DEFAULT_RECT_STYLES.backgroundColor` (transparent)
 * here because a transparent rect on the white page frame is invisible —
 * the user just sees their click do nothing. Light grey is visible and
 * still neutral enough that the user can recolor it from the panel.
 */
const NEW_RECT_BACKGROUND = '#e5e5e5';
const makeRectangle = (input, id) => ({
    ...DEFAULT_RECT_STYLES,
    id,
    type: 'rectangle',
    parentId: input.parentId,
    childIds: [],
    x: input.x,
    y: input.y,
    widthValue: input.width,
    heightValue: input.height,
    backgroundColor: NEW_RECT_BACKGROUND,
    customProperties: {},
});
const TEXT_DEFAULT_WIDTH = 120;
const TEXT_DEFAULT_HEIGHT = 24;
const makeText = (input, id) => ({
    ...DEFAULT_RECT_STYLES,
    id,
    type: 'text',
    parentId: input.parentId,
    childIds: [],
    x: input.x,
    y: input.y,
    widthValue: TEXT_DEFAULT_WIDTH,
    heightValue: TEXT_DEFAULT_HEIGHT,
    customProperties: {},
    text: input.text ?? 'Text',
    fontSize: '14px',
    fontWeight: 400,
    color: '#222222',
    textAlign: 'left',
});
const makeImage = (input, id) => ({
    ...DEFAULT_RECT_STYLES,
    id,
    type: 'image',
    parentId: input.parentId,
    childIds: [],
    x: input.x,
    y: input.y,
    widthValue: input.width,
    heightValue: input.height,
    customProperties: {},
    src: input.src,
    alt: input.alt ?? '',
});
/**
 * Default visual treatment for an input drawn on the canvas — a
 * subtle outlined box so the user can see what they drew. Users are
 * free to re-style from the panel.
 */
const NEW_INPUT_BACKGROUND = '#ffffff';
const NEW_INPUT_BORDER_COLOR = '#cbd5e1';
const makeInput = (input, id) => ({
    ...DEFAULT_RECT_STYLES,
    id,
    type: 'input',
    parentId: input.parentId,
    childIds: [],
    x: input.x,
    y: input.y,
    widthValue: input.width,
    heightValue: input.height,
    backgroundColor: NEW_INPUT_BACKGROUND,
    borderWidth: [1, 1, 1, 1],
    borderStyle: 'solid',
    borderColor: NEW_INPUT_BORDER_COLOR,
    borderRadius: [4, 4, 4, 4],
    customProperties: {},
    attributes: { type: 'text' },
});
/**
 * When a new rectangle or text element is drawn inside a `<ul>` or
 * `<ol>`, default its tag to `<li>` so the output semantic is correct
 * without the user having to open the Element section.
 */
const tagForListChildContext = (parent) => {
    if (!parent)
        return undefined;
    if (parent.tag === 'ul' || parent.tag === 'ol')
        return 'li';
    return undefined;
};
/**
 * Fields that are NEVER written into a breakpoint or state override —
 * they're identity / tree / TSX-level concepts that can't
 * meaningfully change per-axis. A patch containing any of these
 * applies them to the element's top-level fields regardless of the
 * active breakpoint or state.
 */
const BASE_ONLY_PATCH_FIELDS = new Set([
    'id',
    'type',
    'parentId',
    'childIds',
    'breakpointOverrides',
    'stateOverrides',
    'customSelectorBlocks',
    'tag',
    'attributes',
    'selectOptions',
    'svgSource',
    'text',
    'name',
]);
/**
 * Apply a patch to an element while respecting the active breakpoint
 * and state. Routing rules:
 *
 *   - Desktop + default state → patch writes through to top-level.
 *   - Desktop + non-default state → style fields route to
 *     `stateOverrides[activeStateName]`.
 *   - Non-desktop + default state → style fields route to
 *     `breakpointOverrides[activeBreakpointId]`.
 *   - Non-desktop + non-default state → state×breakpoint matrix is
 *     out of scope in this version; the patch is dropped to avoid
 *     silently writing the wrong place. The properties panel UI
 *     disables non-default states at non-desktop breakpoints, so
 *     this shouldn't fire from a normal interaction.
 *
 * Identity / content fields always land on top-level regardless of
 * axis. Pure — takes the element + patch, returns the next element.
 */
const applyPatchWithAxisRouting = (el, patch, activeBreakpointId, activeStateName) => {
    // Split the patch into base (always-top-level) and style (goes to
    // override when an axis is active).
    const basePatch = {};
    const stylePatch = {};
    for (const key of Object.keys(patch)) {
        if (BASE_ONLY_PATCH_FIELDS.has(key)) {
            basePatch[key] = patch[key];
        }
        else {
            stylePatch[key] = patch[key];
        }
    }
    const mergedBase = Object.keys(basePatch).length > 0 ? { ...el, ...basePatch } : el;
    const styleKeys = Object.keys(stylePatch);
    // Desktop + default state — merge style patch onto top-level.
    if (activeBreakpointId === 'desktop' && activeStateName === null) {
        if (styleKeys.length === 0)
            return mergedBase;
        return { ...mergedBase, ...stylePatch };
    }
    if (styleKeys.length === 0)
        return mergedBase;
    // Desktop + non-default state — route to stateOverrides.
    if (activeBreakpointId === 'desktop' && activeStateName !== null) {
        const existingOverride = mergedBase.stateOverrides?.[activeStateName] ?? {};
        const mergedCustom = 'customProperties' in stylePatch && stylePatch.customProperties
            ? {
                ...(existingOverride.customProperties ?? {}),
                ...stylePatch.customProperties,
            }
            : existingOverride.customProperties;
        const nextOverride = {
            ...existingOverride,
            ...stylePatch,
            ...(mergedCustom !== undefined ? { customProperties: mergedCustom } : {}),
        };
        return {
            ...mergedBase,
            stateOverrides: {
                ...mergedBase.stateOverrides,
                [activeStateName]: nextOverride,
            },
        };
    }
    // Non-desktop + non-default state — out of scope. Drop the style
    // patch; base fields already landed via mergedBase. (UI guards
    // against this combination, so this branch should be unreachable in
    // practice — kept as a safety net.)
    if (activeStateName !== null)
        return mergedBase;
    // Non-desktop + default state — route to breakpointOverrides.
    const existingOverride = mergedBase.breakpointOverrides?.[activeBreakpointId] ?? {};
    const mergedCustom = 'customProperties' in stylePatch && stylePatch.customProperties
        ? {
            ...(existingOverride.customProperties ?? {}),
            ...stylePatch.customProperties,
        }
        : existingOverride.customProperties;
    const nextOverride = {
        ...existingOverride,
        ...stylePatch,
        ...(mergedCustom !== undefined ? { customProperties: mergedCustom } : {}),
    };
    return {
        ...mergedBase,
        breakpointOverrides: {
            ...mergedBase.breakpointOverrides,
            [activeBreakpointId]: nextOverride,
        },
    };
};
/** Pick a fresh element id that doesn't collide with any existing one. */
const freshId = (existing) => {
    for (let i = 0; i < 32; i += 1) {
        const candidate = generateElementId();
        if (!existing.has(candidate))
            return candidate;
    }
    let i = 0;
    while (existing.has(`g${i}`))
        i += 1;
    return `g${i}`;
};
export const useCanvasStore = create()(temporal((set) => ({
    elements: { [ROOT_ELEMENT_ID]: makeRootElement() },
    rootElementId: ROOT_ELEMENT_ID,
    selectedElementIds: [],
    editingElementId: null,
    activeTool: 'select',
    activePage: null,
    pageSource: null,
    isLoading: false,
    lastLoadKind: null,
    bottomPanel: 'none',
    panelMode: 'ui',
    userZoom: null,
    activeBreakpointId: 'desktop',
    activeStateName: null,
    breakpoints: [...DEFAULT_BREAKPOINTS],
    projectFormat: 'nextjs',
    projectPath: '',
    pageCustomMediaBlocks: [],
    pageKeyframesBlocks: [],
    previewAnimation: null,
    themeTokens: [],
    clipboard: null,
    setTool: (tool) => set({ activeTool: tool }),
    selectElement: (id) => set({ selectedElementIds: id === null ? [] : [id] }),
    toggleSelectElement: (id) => set((state) => {
        const idx = state.selectedElementIds.indexOf(id);
        if (idx >= 0) {
            const next = [...state.selectedElementIds];
            next.splice(idx, 1);
            return { selectedElementIds: next };
        }
        return { selectedElementIds: [...state.selectedElementIds, id] };
    }),
    createRectangle: (input) => {
        const id = generateElementId();
        set((state) => {
            const parent = state.elements[input.parentId];
            if (!parent)
                return state;
            const contextTag = tagForListChildContext(parent);
            const newRect = makeRectangle(input, id);
            const withTag = contextTag ? { ...newRect, tag: contextTag } : newRect;
            return {
                elements: {
                    ...state.elements,
                    [id]: withTag,
                    [input.parentId]: { ...parent, childIds: [...parent.childIds, id] },
                },
                selectedElementIds: [id],
            };
        });
        return id;
    },
    createText: (input) => {
        const id = generateElementId();
        set((state) => {
            const parent = state.elements[input.parentId];
            if (!parent)
                return state;
            const contextTag = tagForListChildContext(parent);
            const newText = makeText(input, id);
            const withTag = contextTag ? { ...newText, tag: contextTag } : newText;
            return {
                elements: {
                    ...state.elements,
                    [id]: withTag,
                    [input.parentId]: { ...parent, childIds: [...parent.childIds, id] },
                },
                selectedElementIds: [id],
                editingElementId: id,
            };
        });
        return id;
    },
    createImage: (input) => {
        const id = generateElementId();
        set((state) => {
            const parent = state.elements[input.parentId];
            if (!parent)
                return state;
            const newImage = makeImage(input, id);
            return {
                elements: {
                    ...state.elements,
                    [id]: newImage,
                    [input.parentId]: { ...parent, childIds: [...parent.childIds, id] },
                },
                selectedElementIds: [id],
            };
        });
        return id;
    },
    createInput: (input) => {
        const id = generateElementId();
        set((state) => {
            const parent = state.elements[input.parentId];
            if (!parent)
                return state;
            const newInput = makeInput(input, id);
            return {
                elements: {
                    ...state.elements,
                    [id]: newInput,
                    [input.parentId]: { ...parent, childIds: [...parent.childIds, id] },
                },
                selectedElementIds: [id],
            };
        });
        return id;
    },
    deleteElement: (id) => set((state) => {
        // Root is the page frame and can't be removed.
        if (id === ROOT_ELEMENT_ID)
            return state;
        const target = state.elements[id];
        if (!target)
            return state;
        // Collect this element + all descendants so we can drop them in one
        // pass. Walks childIds depth-first; safe because the canvas tree is
        // a tree (no cycles).
        const toRemove = new Set();
        const visit = (visitId) => {
            if (toRemove.has(visitId))
                return;
            toRemove.add(visitId);
            const el = state.elements[visitId];
            if (!el)
                return;
            for (const childId of el.childIds)
                visit(childId);
        };
        visit(id);
        const nextElements = {};
        for (const [key, value] of Object.entries(state.elements)) {
            if (toRemove.has(key))
                continue;
            nextElements[key] = value;
        }
        // Detach from parent's childIds.
        if (target.parentId) {
            const parent = nextElements[target.parentId];
            if (parent) {
                nextElements[target.parentId] = {
                    ...parent,
                    childIds: parent.childIds.filter((childId) => childId !== id),
                };
            }
        }
        return {
            elements: nextElements,
            selectedElementIds: state.selectedElementIds.filter((s) => !toRemove.has(s)),
            editingElementId: state.editingElementId && toRemove.has(state.editingElementId)
                ? null
                : state.editingElementId,
        };
    }),
    duplicateElement: (id) => {
        let createdId = null;
        set((state) => {
            // Root cannot be duplicated — there's only ever one page frame.
            if (id === ROOT_ELEMENT_ID)
                return state;
            const original = state.elements[id];
            if (!original || !original.parentId)
                return state;
            const result = cloneElementSubtree(state.elements, id, original.parentId, new Set(Object.keys(state.elements)));
            if (!result)
                return state;
            const parent = state.elements[original.parentId];
            if (!parent)
                return state;
            const isFlexChild = parent.display === 'flex';
            // Offset the top-level clone so it's visually distinct from the
            // original. Skip the offset for flex children — flex layout owns
            // their position so x/y is meaningless. Clamp to parent bounds
            // so the duplicate doesn't escape the canvas — but when the
            // parent is root, the parent's stored widthValue/heightValue is
            // stale (root defaults to stretch/auto). Skip clamping there and
            // trust the offset.
            const cloneRoot = result.cloned[result.newId];
            const offset = isFlexChild ? 0 : 20;
            const parentIsRoot = parent.id === ROOT_ELEMENT_ID;
            const updatedClone = isFlexChild
                ? cloneRoot
                : parentIsRoot
                    ? {
                        ...cloneRoot,
                        x: cloneRoot.x + offset,
                        y: cloneRoot.y + offset,
                    }
                    : {
                        ...cloneRoot,
                        x: Math.min(Math.max(0, parent.widthValue - cloneRoot.widthValue), cloneRoot.x + offset),
                        y: Math.min(Math.max(0, parent.heightValue - cloneRoot.heightValue), cloneRoot.y + offset),
                    };
            // Insert the clone right after the original in childIds so it
            // appears as the next sibling — important for flex layouts where
            // sibling order is the only positioning signal.
            const idx = parent.childIds.indexOf(id);
            const insertAt = idx >= 0 ? idx + 1 : parent.childIds.length;
            const newChildIds = [...parent.childIds];
            newChildIds.splice(insertAt, 0, result.newId);
            const updatedParent = { ...parent, childIds: newChildIds };
            createdId = result.newId;
            return {
                elements: {
                    ...state.elements,
                    ...result.cloned,
                    [result.newId]: updatedClone,
                    [updatedParent.id]: updatedParent,
                },
                selectedElementIds: [result.newId],
            };
        });
        return createdId;
    },
    copyElement: (id) => {
        set((state) => {
            if (id === ROOT_ELEMENT_ID)
                return state;
            const el = state.elements[id];
            if (!el)
                return state;
            // Deep-copy the subtree into the clipboard. Walk depth-first and
            // collect every element in the subtree keyed by its original id.
            const snapshot = {};
            const visit = (visitId) => {
                const node = state.elements[visitId];
                if (!node)
                    return;
                snapshot[visitId] = {
                    ...node,
                    customProperties: { ...node.customProperties },
                    padding: [...node.padding],
                    margin: [...node.margin],
                    borderRadius: [...node.borderRadius],
                    borderWidth: [...node.borderWidth],
                };
                for (const childId of node.childIds)
                    visit(childId);
            };
            visit(id);
            return { clipboard: { elements: snapshot, rootId: id } };
        });
    },
    pasteElement: () => {
        let createdId = null;
        set((state) => {
            if (!state.clipboard)
                return state;
            // Paste INTO the selected element as its last child. If nothing
            // is selected, paste into the root.
            const selectedId = state.selectedElementIds[0];
            const parentId = selectedId ?? ROOT_ELEMENT_ID;
            const parent = state.elements[parentId];
            if (!parent)
                return state;
            const insertIdx = parent.childIds.length;
            // Clone the clipboard subtree with fresh IDs.
            const result = cloneElementSubtree(state.clipboard.elements, state.clipboard.rootId, parentId, new Set(Object.keys(state.elements)));
            if (!result)
                return state;
            const newChildIds = [...parent.childIds];
            newChildIds.splice(insertIdx, 0, result.newId);
            const updatedParent = { ...parent, childIds: newChildIds };
            createdId = result.newId;
            return {
                elements: {
                    ...state.elements,
                    ...result.cloned,
                    [updatedParent.id]: updatedParent,
                },
                selectedElementIds: [result.newId],
            };
        });
        return createdId;
    },
    groupElements: (ids) => {
        let createdId = null;
        set((state) => {
            if (ids.length === 0)
                return state;
            const groupId = freshId(new Set(Object.keys(state.elements)));
            const result = groupSiblings(state.elements, ids, groupId);
            if (!result)
                return state;
            createdId = result.groupId;
            return {
                elements: result.elements,
                selectedElementIds: [result.groupId],
            };
        });
        return createdId;
    },
    ungroupElement: (id) => set((state) => {
        const result = ungroupSiblings(state.elements, id);
        if (!result)
            return state;
        return {
            elements: result.elements,
            selectedElementIds: result.promotedIds,
        };
    }),
    reorderElement: (elementId, newParentId, newIndex) => set((state) => {
        const next = reorderElementPure(state.elements, elementId, newParentId, newIndex);
        if (!next)
            return state;
        return { elements: next };
    }),
    setEditingElement: (id) => set({ editingElementId: id }),
    setElementText: (id, text) => set((state) => {
        const el = state.elements[id];
        if (!el)
            return state;
        return {
            elements: { ...state.elements, [id]: { ...el, text } },
        };
    }),
    moveElement: (id, x, y) => set((state) => {
        const el = state.elements[id];
        if (!el)
            return state;
        // Direct manipulation (drag-to-move) always lands on the base —
        // never on a state override, even if a state is active in the
        // panel. Moving an element on the canvas is a layout edit, not
        // a hover-state design decision.
        const next = applyPatchWithAxisRouting(el, { x, y }, state.activeBreakpointId, null);
        return { elements: { ...state.elements, [id]: next } };
    }),
    resizeElement: (id, x, y, width, height) => set((state) => {
        const el = state.elements[id];
        if (!el)
            return state;
        // Dragging a handle is an explicit "I want this size" gesture, so
        // we always switch to fixed mode — otherwise resizing a stretched
        // or fit-content element would silently store a value that the
        // generator wouldn't emit. Like moveElement, resize edits land
        // on the base regardless of the active state.
        const next = applyPatchWithAxisRouting(el, {
            x,
            y,
            widthValue: width,
            heightValue: height,
            widthMode: 'fixed',
            heightMode: 'fixed',
        }, state.activeBreakpointId, null);
        return { elements: { ...state.elements, [id]: next } };
    }),
    patchElement: (id, patch) => set((state) => {
        const el = state.elements[id];
        if (!el)
            return state;
        const next = applyPatchWithAxisRouting(el, patch, state.activeBreakpointId, state.activeStateName);
        return { elements: { ...state.elements, [id]: next } };
    }),
    resetElementFieldsAtBreakpoint: (id, breakpointId, fields) => set((state) => {
        if (breakpointId === 'desktop')
            return state;
        const el = state.elements[id];
        if (!el || !el.breakpointOverrides)
            return state;
        const existing = el.breakpointOverrides[breakpointId];
        if (!existing)
            return state;
        const nextOverride = { ...existing };
        for (const field of fields) {
            delete nextOverride[field];
        }
        const overrides = { ...el.breakpointOverrides };
        if (Object.keys(nextOverride).length === 0) {
            // Empty override object — drop the breakpoint key so
            // generateCode won't emit an empty @media rule.
            delete overrides[breakpointId];
        }
        else {
            overrides[breakpointId] = nextOverride;
        }
        // If no breakpoints have any overrides, delete the whole field
        // so round-trips stay text-stable.
        const { breakpointOverrides: _, ...elWithoutOverrides } = el;
        const nextElement = Object.keys(overrides).length === 0
            ? elWithoutOverrides
            : { ...el, breakpointOverrides: overrides };
        return {
            elements: { ...state.elements, [id]: nextElement },
        };
    }),
    resetElementFieldsAtState: (id, stateName, fields) => set((state) => {
        const el = state.elements[id];
        if (!el || !el.stateOverrides)
            return state;
        const existing = el.stateOverrides[stateName];
        if (!existing)
            return state;
        const nextOverride = { ...existing };
        for (const field of fields) {
            delete nextOverride[field];
        }
        const overrides = {
            ...el.stateOverrides,
        };
        if (Object.keys(nextOverride).length === 0) {
            // Empty override object — drop the state key so generateCode
            // won't emit an empty pseudo-class block.
            delete overrides[stateName];
        }
        else {
            overrides[stateName] = nextOverride;
        }
        // If no states have any overrides, delete the whole field so
        // round-trips stay text-stable.
        const { stateOverrides: _, ...elWithoutOverrides } = el;
        const nextElement = Object.keys(overrides).length === 0
            ? elWithoutOverrides
            : { ...el, stateOverrides: overrides };
        return {
            elements: { ...state.elements, [id]: nextElement },
        };
    }),
    setAnimation: (id, animation) => set((state) => {
        const el = state.elements[id];
        if (!el)
            return state;
        // Route the animation patch through the same axis-routing the
        // panel sections use — base when default state is active, the
        // matching state override otherwise.
        const next = applyPatchWithAxisRouting(el, { animation }, state.activeBreakpointId, state.activeStateName);
        // Ensure a `KeyframesBlock` exists for the chosen name. If the
        // page already has one with this name (preset or agent-edited),
        // leave it alone — preserves user intent. If absent, append the
        // canonical preset body for known presets; for unknown names
        // we leave it absent (the agent owns those).
        let keyframes = state.pageKeyframesBlocks;
        const existing = keyframes.find((b) => b.name === animation.name);
        if (!existing && isPresetName(animation.name)) {
            const preset = PRESETS_BY_NAME.get(animation.name);
            if (preset) {
                keyframes = [
                    ...keyframes,
                    { name: preset.name, body: preset.body, isPreset: true },
                ];
            }
        }
        return {
            elements: { ...state.elements, [id]: next },
            pageKeyframesBlocks: keyframes,
        };
    }),
    removeAnimation: (id) => set((state) => {
        const el = state.elements[id];
        if (!el)
            return state;
        // Two cases: clear the base animation, or clear the active
        // state's animation override.
        if (state.activeStateName === null) {
            const { animation: _drop, ...rest } = el;
            const nextEl = el.animation === undefined ? el : rest;
            return { elements: { ...state.elements, [id]: nextEl } };
        }
        const overrides = el.stateOverrides;
        const stateOverride = overrides?.[state.activeStateName];
        if (!overrides || !stateOverride)
            return state;
        const { animation: _drop, ...restOverride } = stateOverride;
        const nextOverrides = {
            ...overrides,
        };
        if (Object.keys(restOverride).length === 0) {
            delete nextOverrides[state.activeStateName];
        }
        else {
            nextOverrides[state.activeStateName] = restOverride;
        }
        // Drop the whole stateOverrides field if no states remain so
        // round-trips stay text-stable.
        const { stateOverrides: _o, ...elNoStates } = el;
        const nextEl = Object.keys(nextOverrides).length === 0
            ? elNoStates
            : { ...el, stateOverrides: nextOverrides };
        return { elements: { ...state.elements, [id]: nextEl } };
    }),
    playAnimation: (elementId) => set((state) => ({
        previewAnimation: {
            elementId,
            // Increment the key so the renderer's React `key` changes
            // even when the user clicks Play repeatedly on the same
            // element.
            key: (state.previewAnimation?.elementId === elementId
                ? state.previewAnimation.key
                : 0) + 1,
        },
    })),
    loadPage: (page, elements, source, customMediaBlocks, keyframesBlocks) => set({
        activePage: page,
        elements,
        pageSource: source,
        pageCustomMediaBlocks: customMediaBlocks ?? [],
        pageKeyframesBlocks: keyframesBlocks ?? [],
        selectedElementIds: [],
        isLoading: true,
        lastLoadKind: 'initial',
    }),
    reloadElements: (elements, source, customMediaBlocks, keyframesBlocks) => set((state) => ({
        elements,
        pageSource: source,
        pageCustomMediaBlocks: customMediaBlocks ?? state.pageCustomMediaBlocks,
        pageKeyframesBlocks: keyframesBlocks ?? state.pageKeyframesBlocks,
        // Drop any selection that no longer exists in the new tree (the file
        // could have been edited externally to remove an element).
        selectedElementIds: state.selectedElementIds.filter((id) => id in elements),
        isLoading: true,
        lastLoadKind: 'external',
    })),
    setPageSource: (source) => set({ pageSource: source }),
    setBottomPanel: (panel) => set({ bottomPanel: panel }),
    setPanelMode: (mode) => set({ panelMode: mode }),
    setActiveBreakpoint: (id) => set({ activeBreakpointId: id }),
    setActiveState: (activeStateName) => set({ activeStateName }),
    setBreakpoints: (breakpoints) => set({ breakpoints }),
    setProjectFormat: (projectFormat) => set({ projectFormat }),
    setProjectPath: (projectPath) => set({ projectPath }),
    zoomIn: () => set((state) => {
        // Coming from fit-mode, treat the current effective zoom as 1.0
        // (100%). The user pressed "in" — they want to grow, so anchor at
        // 100% rather than the auto-fit value (which might be < 1) so the
        // first tap reliably gets bigger.
        const current = state.userZoom ?? 1;
        const next = ZOOM_STEPS.find((s) => s > current + 1e-3) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1];
        return { userZoom: next };
    }),
    zoomOut: () => set((state) => {
        const current = state.userZoom ?? 1;
        // Largest step strictly less than current; walk the list backwards.
        let next = ZOOM_STEPS[0];
        for (let i = ZOOM_STEPS.length - 1; i >= 0; i -= 1) {
            const step = ZOOM_STEPS[i];
            if (step < current - 1e-3) {
                next = step;
                break;
            }
        }
        return { userZoom: next };
    }),
    resetZoom: () => set({ userZoom: null }),
    setZoom: (zoom) => set({ userZoom: zoom }),
    setThemeTokens: (tokens) => set({ themeTokens: tokens }),
    openThemePanel: null,
    setOpenThemePanel: (fn) => set({ openThemePanel: fn }),
    resetForNewPage: () => set({
        elements: { [ROOT_ELEMENT_ID]: makeRootElement() },
        selectedElementIds: [],
        editingElementId: null,
        activePage: null,
        pageSource: null,
        isLoading: false,
        // Drop the manual zoom too — we want a fresh project to start in
        // fit-to-container mode regardless of the previous session.
        userZoom: null,
    }),
}), {
    // Only track element state for undo/redo — ignore UI state like
    // activeTool, selectedElementIds, bottomPanel, panelMode, etc.
    partialize: (state) => ({ elements: state.elements }),
    limit: 50,
    // Avoid recording history when the store is loading from disk
    // (page load, external file change). Those mutations call
    // set({ isLoading: true }), but partialize only sees `elements`
    // so we use the equality check to skip recording when the whole
    // elements map is replaced wholesale during a load.
    equality: (a, b) => a.elements === b.elements,
}));
// ---- Derived selectors ----
const EXCLUDED_COLORS = new Set(['transparent', 'inherit', 'initial', 'unset', 'currentColor']);
/**
 * Extract all color values used across every element in the current page.
 * Deduplicated and sorted by frequency (most used first). Returns an empty
 * array when no meaningful colors are found.
 */
export const selectProjectColors = (state) => {
    const freq = new Map();
    for (const el of Object.values(state.elements)) {
        const colors = [el.backgroundColor, el.borderColor, el.color].filter((c) => typeof c === 'string' && c.length > 0 && !EXCLUDED_COLORS.has(c));
        for (const c of colors) {
            freq.set(c, (freq.get(c) ?? 0) + 1);
        }
    }
    if (freq.size === 0)
        return [];
    return [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([color]) => color);
};
