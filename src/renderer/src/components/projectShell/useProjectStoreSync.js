import { useEffect } from 'react';
import { DEFAULT_COMPONENT_CANVAS_SIZE } from '@shared/types';
import { useCanvasStore } from '@store/canvasSlice';
import { parseCode } from '@lib/parseCode';
/**
 * Pushes the read-only project + config state that deeply-nested canvas
 * components need into the canvas store, so they don't have to prop-drill
 * or walk paths: the project format (for the sync bridge's CSS-module
 * import basename), root path, page-name list, the parsed component-tree
 * cache (instances render from it), and the active target's canvas
 * min-height.
 */
export const useProjectStoreSync = ({ project, projectConfig, activeComponent, }) => {
    // Mirror the project format so the sync bridge can pick the right
    // CSS-module import basename when emitting code.
    useEffect(() => {
        useCanvasStore.getState().setProjectFormat(project.format);
    }, [project.format]);
    // Mirror the project root path so deeply-nested components don't
    // have to walk up from `activePage.tsxPath` (which gets the wrong
    // answer for nested nextjs page folders).
    useEffect(() => {
        useCanvasStore.getState().setProjectPath(project.path);
    }, [project.path]);
    // Mirror the project's page list so the Link section's destination
    // dropdown and the canvas link indicator's broken-link check have
    // a fast lookup without prop drilling.
    useEffect(() => {
        useCanvasStore.getState().setPageNames(project.pages.map((p) => p.name));
    }, [project.pages]);
    // Parse every component's TSX/CSS into an element tree and push
    // the result into the canvas store's componentTrees cache. The
    // renderer reads from there when it hits a `component-instance`
    // element on a page. Re-runs on every `project.components`
    // reference change so component edits (via the editor OR an
    // external agent) propagate live to every instance on every
    // page without per-page work.
    useEffect(() => {
        const trees = {};
        for (const component of project.components) {
            try {
                const parsed = parseCode(component.tsxContent, component.cssContent, {
                    breakpoints: projectConfig.breakpoints,
                    isComponent: true,
                });
                trees[component.name] = {
                    elements: parsed.elements,
                    rootId: parsed.rootId,
                };
            }
            catch (err) {
                // Skip the component — its instances will render as
                // missing-component placeholders. Log so the dev console
                // surfaces the parse failure.
                console.error('[ProjectShell] parseCode failed for component', component.name, err);
            }
        }
        useCanvasStore.getState().setComponentTrees(trees);
    }, [project.components, projectConfig.breakpoints]);
    // Keep the canvas min-height in sync with the active target.
    // Page editor: 900 (matches EMPTY_FRAME_MIN_HEIGHT — the empty-
    // page canvas baseline). Component editor: the user-configured
    // `componentCanvas[name].height` (or its default fallback).
    // The root element's render branch reads from this, so the
    // root fills the visible canvas frame regardless of content
    // size, and clicks on "empty" canvas area still hit the root.
    useEffect(() => {
        const next = activeComponent !== null
            ? (projectConfig.componentCanvas?.[activeComponent.name]?.height ??
                DEFAULT_COMPONENT_CANVAS_SIZE.height)
            : 900;
        useCanvasStore.getState().setCanvasMinHeight(next);
    }, [activeComponent, projectConfig.componentCanvas]);
};
