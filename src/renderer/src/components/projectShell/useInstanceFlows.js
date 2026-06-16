import { useEffect, useState } from 'react';
import { errorMessage } from '@shared/errorMessage';
import { useCanvasStore } from '@store/canvasSlice';
import { generateComponentFromSubtree } from '@lib/extractComponent';
import { filterUsagesWithPropOverride, findInstanceUsagesAcrossPages, groupUsagesByPage, } from '@lib/componentUsage';
import { CONVERT_TO_COMPONENT_EVENT, DETACH_INSTANCE_EVENT, } from '../ElementContextMenu';
import { REQUEST_LOCK_PROP_EVENT, } from '../DataPanel';
/**
 * Owns the multi-file component-instance flows that ProjectShell drives
 * through confirmation modals: convert-to-component, lock-prop-with-
 * overrides, delete-prop-text-with-overrides, and detach. Each subscribes
 * to its menu/canvas event (except delete-prop-text, which the keyboard
 * handler raises via the exposed setter) and exposes the request state +
 * confirm/cancel handlers the modals bind to.
 * see docs/notes/components-multi-file-ops.md
 */
export const useInstanceFlows = ({ project, onProjectChange, openComponent, activePageName, }) => {
    // ---- Convert-to-component flow ----
    // Element id queued for the create-component dialog. Set when
    // the user picks "Create component…" from the right-click
    // menu; cleared on cancel or after the new component lands.
    const [convertElementId, setConvertElementId] = useState(null);
    const [convertingComponent, setConvertingComponent] = useState(false);
    const [convertError, setConvertError] = useState(null);
    // Subscribe to the menu's `scamp:convert-to-component` event.
    // The handler stashes the element id so the dialog renders on
    // the next paint; the actual write happens on the dialog's
    // confirm.
    useEffect(() => {
        const handler = (e) => {
            const detail = e.detail;
            if (!detail)
                return;
            setConvertError(null);
            setConvertElementId(detail.elementId);
        };
        window.addEventListener(CONVERT_TO_COMPONENT_EVENT, handler);
        return () => window.removeEventListener(CONVERT_TO_COMPONENT_EVENT, handler);
    }, []);
    const handleConvertToComponent = async (elementId, name) => {
        setConvertingComponent(true);
        setConvertError(null);
        try {
            const state = useCanvasStore.getState();
            const generated = generateComponentFromSubtree(state.elements, elementId, name, state.breakpoints);
            if (!generated) {
                throw new Error('Could not extract the selected element.');
            }
            const created = await window.scamp.createComponent({
                projectPath: project.path,
                componentName: name,
                tsxContent: generated.tsx,
                cssContent: generated.css,
            });
            state.replaceSubtreeWithInstance(elementId, name);
            // Functional updater composes with openComponent's follow-on setProject.
            onProjectChange?.((prev) => ({
                ...prev,
                components: [...prev.components, created],
            }));
            setConvertElementId(null);
            openComponent(created.name, activePageName);
        }
        catch (e) {
            setConvertError(errorMessage(e));
        }
        finally {
            setConvertingComponent(false);
        }
    };
    const cancelConvert = () => {
        if (convertingComponent)
            return;
        setConvertElementId(null);
        setConvertError(null);
    };
    // ---- Lock-prop-with-overrides warning ----
    const [lockPropRequest, setLockPropRequest] = useState(null);
    useEffect(() => {
        const handler = (e) => {
            const detail = e.detail;
            if (!detail)
                return;
            const usages = findInstanceUsagesAcrossPages(project.pages, detail.componentName);
            const overriding = filterUsagesWithPropOverride(usages, detail.propName);
            if (overriding.length === 0) {
                useCanvasStore.getState().togglePropOnText(detail.elementId);
                return;
            }
            setLockPropRequest({
                elementId: detail.elementId,
                propName: detail.propName,
                impactByPage: groupUsagesByPage(overriding),
            });
        };
        window.addEventListener(REQUEST_LOCK_PROP_EVENT, handler);
        return () => window.removeEventListener(REQUEST_LOCK_PROP_EVENT, handler);
    }, [project.pages]);
    const handleConfirmLockProp = () => {
        if (!lockPropRequest)
            return;
        useCanvasStore.getState().togglePropOnText(lockPropRequest.elementId);
        setLockPropRequest(null);
    };
    const cancelLockProp = () => setLockPropRequest(null);
    // ---- Delete-prop-text warning when instances override it ----
    // The request is raised from the global keyboard handler via the
    // exposed setter; this hook owns the resulting modal + confirm.
    const [deletePropTextRequest, setDeletePropTextRequest] = useState(null);
    const handleConfirmDeletePropText = () => {
        if (!deletePropTextRequest)
            return;
        const state = useCanvasStore.getState();
        for (const id of deletePropTextRequest.elementIds) {
            if (id === state.rootElementId)
                continue;
            useCanvasStore.getState().deleteElement(id);
        }
        setDeletePropTextRequest(null);
    };
    const cancelDeletePropText = () => setDeletePropTextRequest(null);
    // ---- Detach-from-component flow ----
    const [detachRequest, setDetachRequest] = useState(null);
    useEffect(() => {
        const handler = (e) => {
            const detail = e.detail;
            if (!detail)
                return;
            const state = useCanvasStore.getState();
            const el = state.elements[detail.instanceId];
            if (!el || el.type !== 'component-instance')
                return;
            const componentName = el.componentName ?? '(unnamed)';
            const overrideCount = Object.keys(el.propOverrides ?? {}).length;
            setDetachRequest({
                instanceId: detail.instanceId,
                componentName,
                overrideCount,
            });
        };
        window.addEventListener(DETACH_INSTANCE_EVENT, handler);
        return () => window.removeEventListener(DETACH_INSTANCE_EVENT, handler);
    }, []);
    const handleConfirmDetach = () => {
        if (!detachRequest)
            return;
        useCanvasStore.getState().detachInstance(detachRequest.instanceId);
        setDetachRequest(null);
    };
    const cancelDetach = () => setDetachRequest(null);
    return {
        convertElementId,
        convertingComponent,
        convertError,
        handleConvertToComponent,
        cancelConvert,
        lockPropRequest,
        handleConfirmLockProp,
        cancelLockProp,
        deletePropTextRequest,
        setDeletePropTextRequest,
        handleConfirmDeletePropText,
        cancelDeletePropText,
        detachRequest,
        handleConfirmDetach,
        cancelDetach,
    };
};
