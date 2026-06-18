import { useState, } from 'react';
import { errorMessage } from '@shared/errorMessage';
import { useCanvasStore } from '@store/canvasSlice';
import { useAppLogStore } from '@store/appLogSlice';
import { parseCode } from '@lib/parseCode';
import { generateCode } from '@lib/generateCode';
import { findInstanceUsagesAcrossPages, groupUsagesByPage, } from '@lib/componentUsage';
import { rewriteComponentForRename, rewritePageForComponentRename, } from '@lib/componentRename';
import { armTargetSwapSuppression, disarmTargetSwapSuppression, flushPendingPageWrite, } from '../../syncBridge';
/**
 * Owns the Components sidebar's inline-edit + context-menu state and the
 * multi-file component-management handlers: add (create + enter editor),
 * rename (rewrite the component + every referencing page, rekey nothing —
 * pages keep their order), and delete (strip every instance from each
 * page, then remove the folder). Delete/rename arm target-swap
 * suppression so the watcher doesn't fight the in-flight multi-file write.
 * see docs/notes/components-multi-file-ops.md
 */
export const useComponentManagement = ({ project, onProjectChange, activeComponent, setActiveComponentState, openComponent, persistActiveSource, }) => {
    // Brief in-progress flag while `+ component` is creating a new
    // component on disk. Disables the add-button + name input.
    const [creatingComponent, setCreatingComponent] = useState(false);
    // Inline-edit state for the components list.
    //   `'new'` — PascalCase name input at the bottom (Create).
    //   `{ rename: name }` — replaces that component's button with
    //     a name input pre-filled with `name`.
    //   `null` — no editing in progress.
    const [componentEdit, setComponentEdit] = useState(null);
    const [componentEditError, setComponentEditError] = useState(null);
    const [renamingComponent, setRenamingComponent] = useState(false);
    // Phase 7: component-sidebar context menu (right-click) +
    // delete-component flow. Holds the menu coords + target name
    // while open; cleared on dismiss.
    const [componentMenu, setComponentMenu] = useState(null);
    const [deletingComponent, setDeletingComponent] = useState(null);
    const [componentDeleteBusy, setComponentDeleteBusy] = useState(false);
    /**
     * Atomic add: create the component on disk, append to the
     * project list, and immediately enter its editor. PascalCase
     * validation happens main-side too; this rejects locally first
     * so users see invalid-name errors without an IPC round trip.
     */
    const handleAddComponent = async (name) => {
        setCreatingComponent(true);
        setComponentEditError(null);
        try {
            const created = await window.scamp.createComponent({
                projectPath: project.path,
                componentName: name,
            });
            // Functional updater so this composes with `openComponent`'s
            // follow-on `persistActiveSource` if the outgoing page has
            // unsaved edits — otherwise the second setProject would
            // clobber the new component out of `project.components`.
            onProjectChange?.((prev) => ({
                ...prev,
                components: [...prev.components, created],
            }));
            setComponentEdit(null);
            openComponent(created.name, null);
        }
        catch (e) {
            setComponentEditError(errorMessage(e));
        }
        finally {
            setCreatingComponent(false);
        }
    };
    const openComponentMenu = (e, componentName) => {
        e.preventDefault();
        e.stopPropagation();
        setComponentMenu({ x: e.clientX, y: e.clientY, componentName });
    };
    const requestDeleteComponent = (componentName) => {
        const usages = findInstanceUsagesAcrossPages(project.pages, componentName);
        setDeletingComponent({
            componentName,
            impactByPage: groupUsagesByPage(usages),
        });
    };
    const handleConfirmDeleteComponent = async () => {
        if (!deletingComponent)
            return;
        const { componentName } = deletingComponent;
        setComponentDeleteBusy(true);
        armTargetSwapSuppression();
        try {
            const breakpoints = useCanvasStore.getState().breakpoints;
            const updatedPages = [];
            for (const page of project.pages) {
                const parsed = parseCode(page.tsxContent, page.cssContent, {
                    breakpoints,
                });
                const toRemove = new Set();
                for (const el of Object.values(parsed.elements)) {
                    if (el.type === 'component-instance' && el.componentName === componentName) {
                        toRemove.add(el.id);
                    }
                }
                if (toRemove.size === 0) {
                    updatedPages.push(page);
                    continue;
                }
                const nextElements = {};
                for (const [id, el] of Object.entries(parsed.elements)) {
                    if (toRemove.has(id))
                        continue;
                    nextElements[id] = {
                        ...el,
                        childIds: el.childIds.filter((c) => !toRemove.has(c)),
                    };
                }
                const rewritten = generateCode({
                    elements: nextElements,
                    rootId: parsed.rootId,
                    pageName: page.name,
                    breakpoints,
                    customMediaBlocks: parsed.customMediaBlocks,
                    pageKeyframesBlocks: parsed.keyframesBlocks,
                    cssModuleImportName: project.format === 'nextjs' ? 'page' : page.name,
                });
                await window.scamp.writeFile({
                    tsxPath: page.tsxPath,
                    cssPath: page.cssPath,
                    tsxContent: rewritten.tsx,
                    cssContent: rewritten.css,
                });
                updatedPages.push({
                    ...page,
                    tsxContent: rewritten.tsx,
                    cssContent: rewritten.css,
                });
            }
            // Folder removal AFTER page rewrites so imports don't dangle.
            await window.scamp.deleteComponent({
                projectPath: project.path,
                componentName,
            });
            const wasEditingDeleted = activeComponent !== null && activeComponent.name === componentName;
            if (wasEditingDeleted) {
                setActiveComponentState(null);
            }
            onProjectChange?.({
                ...project,
                pages: updatedPages,
                components: project.components.filter((c) => c.name !== componentName),
            });
            setDeletingComponent(null);
        }
        catch (err) {
            disarmTargetSwapSuppression();
            const message = errorMessage(err);
            useAppLogStore
                .getState()
                .log('warn', `Delete component "${componentName}" failed: ${message}`);
        }
        finally {
            setComponentDeleteBusy(false);
        }
    };
    const handleRenameComponent = async (oldName, newName) => {
        if (oldName === newName) {
            setComponentEdit(null);
            return;
        }
        setRenamingComponent(true);
        setComponentEditError(null);
        armTargetSwapSuppression();
        try {
            flushPendingPageWrite();
            persistActiveSource();
            const breakpoints = useCanvasStore.getState().breakpoints;
            const sourceComponent = project.components.find((c) => c.name === oldName);
            if (!sourceComponent) {
                throw new Error(`Component "${oldName}" not found in project.`);
            }
            const newContent = rewriteComponentForRename(sourceComponent.tsxContent, sourceComponent.cssContent, oldName, newName, { breakpoints });
            // Skip pages that don't reference oldName — keeps them byte-stable.
            const rewrittenPages = [];
            const unchangedPages = [];
            for (const page of project.pages) {
                const result = rewritePageForComponentRename(page.tsxContent, page.cssContent, oldName, newName, page.name, project.format, { breakpoints });
                if (result.changed) {
                    rewrittenPages.push({
                        file: page,
                        tsx: result.tsx,
                        css: result.css,
                    });
                }
                else {
                    unchangedPages.push(page);
                }
            }
            const newComponentFile = await window.scamp.createComponent({
                projectPath: project.path,
                componentName: newName,
                tsxContent: newContent.tsx,
                cssContent: newContent.css,
            });
            for (const entry of rewrittenPages) {
                await window.scamp.writeFile({
                    tsxPath: entry.file.tsxPath,
                    cssPath: entry.file.cssPath,
                    tsxContent: entry.tsx,
                    cssContent: entry.css,
                });
            }
            // Old folder removed last so page imports don't dangle.
            await window.scamp.deleteComponent({
                projectPath: project.path,
                componentName: oldName,
            });
            const nextComponents = project.components.map((c) => c.name === oldName ? newComponentFile : c);
            const nextPages = [
                ...unchangedPages,
                ...rewrittenPages.map((e) => ({
                    ...e.file,
                    tsxContent: e.tsx,
                    cssContent: e.css,
                })),
            ];
            // Preserve original page order so the sidebar doesn't reshuffle.
            const orderedPages = project.pages.map((p) => {
                const rewritten = rewrittenPages.find((e) => e.file.name === p.name);
                if (rewritten) {
                    return {
                        ...p,
                        tsxContent: rewritten.tsx,
                        cssContent: rewritten.css,
                    };
                }
                return p;
            });
            void nextPages; // keep types tidy when the ordered variant wins below
            onProjectChange?.({
                ...project,
                components: nextComponents,
                pages: orderedPages,
            });
            if (activeComponent !== null && activeComponent.name === oldName) {
                setActiveComponentState({
                    name: newName,
                    returnToPage: activeComponent.returnToPage,
                });
            }
            // Keep active page's in-memory componentName fields consistent.
            useCanvasStore.getState().renameComponentReferences(oldName, newName);
            setComponentEdit(null);
        }
        catch (err) {
            disarmTargetSwapSuppression();
            const message = errorMessage(err);
            setComponentEditError(message);
            useAppLogStore
                .getState()
                .log('warn', `Rename component "${oldName}" → "${newName}" failed: ${message}`);
        }
        finally {
            setRenamingComponent(false);
        }
    };
    return {
        componentEdit,
        setComponentEdit,
        componentEditError,
        setComponentEditError,
        creatingComponent,
        renamingComponent,
        handleAddComponent,
        handleRenameComponent,
        openComponentMenu,
        componentMenu,
        closeComponentMenu: () => setComponentMenu(null),
        requestDeleteComponent,
        deletingComponent,
        setDeletingComponent,
        componentDeleteBusy,
        handleConfirmDeleteComponent,
    };
};
