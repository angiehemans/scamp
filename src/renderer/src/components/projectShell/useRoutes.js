import { useCallback, useEffect, useState } from 'react';
import { viewSlugFor } from '@shared/templates';
import { errorMessage } from '@shared/errorMessage';
import { useCanvasStore } from '@store/canvasSlice';
import { useAppLogStore } from '@store/appLogSlice';
import { collectViewProps } from '@lib/viewProps';
import { generateRouteTsx, routeFileForSlug } from '@lib/generateRoute';
/**
 * The routes of a Scamp-framework project as the sidebar shows them:
 * read from the project on open, re-read when a file under routes/
 * changes on disk, and after the two writes the app makes (the render
 * export, a generated route). see docs/notes/routes-in-the-app.md
 */
export const useRoutes = (project) => {
    const [routes, setRoutes] = useState(project.routes ?? []);
    const [busy, setBusy] = useState(false);
    const enabled = project.format === 'scamp';
    useEffect(() => {
        setRoutes(project.routes ?? []);
    }, [project.routes]);
    const refresh = useCallback(async () => {
        if (!enabled)
            return;
        try {
            setRoutes(await window.scamp.listRoutes({ projectPath: project.path }));
        }
        catch (err) {
            useAppLogStore.getState().log('warn', `Could not list routes: ${errorMessage(err)}`);
        }
    }, [enabled, project.path]);
    // A route written by hand or by an agent shows up without a reopen.
    useEffect(() => {
        if (!enabled)
            return;
        return window.scamp.onRoutesChanged(() => void refresh());
    }, [enabled, refresh]);
    const openRoute = useCallback(async (file) => {
        try {
            const content = await window.scamp.readRoute({ projectPath: project.path, file });
            const store = useCanvasStore.getState();
            store.setRouteSource({ file, content });
            store.setBottomPanel('code');
        }
        catch (err) {
            useAppLogStore.getState().log('error', `Could not open routes/${file}: ${errorMessage(err)}`);
        }
    }, [project.path]);
    const setRender = useCallback(async (file, render) => {
        setBusy(true);
        try {
            await window.scamp.setRouteRender({ projectPath: project.path, file, render });
            await refresh();
            useAppLogStore.getState().log('info', `routes/${file}: render = '${render}'`);
        }
        catch (err) {
            useAppLogStore.getState().log('error', `Could not set the render mode: ${errorMessage(err)}`);
        }
        finally {
            setBusy(false);
        }
    }, [project.path, refresh]);
    const writeRouteFor = useCallback(async (viewName, opts) => {
        setBusy(true);
        try {
            const tree = useCanvasStore.getState().componentTrees[viewName];
            // A page created a moment ago may not have loaded its tree yet.
            // It has no props either — it is the empty scaffold — so an
            // empty list is the right answer rather than a reason to fail.
            if (!tree && !opts.allowUnloaded) {
                throw new Error(`The view "${viewName}" is not loaded.`);
            }
            const slug = viewSlugFor(viewName);
            const file = routeFileForSlug(slug);
            const content = generateRouteTsx({
                viewName,
                slug,
                props: tree ? collectViewProps(tree.elements, tree.rootId) : [],
                hasDatabase: project.hasDatabase === true,
            });
            await window.scamp.writeRoute({ projectPath: project.path, file, content });
            await refresh();
            useAppLogStore
                .getState()
                .log('info', `Wrote routes/${file}: load() returns the ${viewName} view's sample data. Replace it with real data.`);
            if (opts.open)
                await openRoute(file);
        }
        catch (err) {
            useAppLogStore.getState().log('error', `Generate route failed: ${errorMessage(err)}`);
        }
        finally {
            setBusy(false);
        }
    }, [openRoute, project.hasDatabase, project.path, refresh]);
    const generateRoute = useCallback((viewName) => writeRouteFor(viewName, { open: true, allowUnloaded: false }), [writeRouteFor]);
    const ensureRoute = useCallback(async (viewName) => {
        if (!enabled)
            return;
        const already = routes.some((r) => r.kind === 'page' && r.view === viewName);
        if (already)
            return;
        await writeRouteFor(viewName, { open: false, allowUnloaded: true });
    }, [enabled, routes, writeRouteFor]);
    const renameRouteView = useCallback(async (oldView, newView) => {
        if (!enabled)
            return;
        try {
            const file = await window.scamp.renameRouteView({
                projectPath: project.path,
                oldView,
                newView,
            });
            if (file === null)
                return;
            await refresh();
            useAppLogStore
                .getState()
                .log('info', `routes/${file} now renders ${newView}.`);
        }
        catch (err) {
            // The view is already renamed; say what is left to fix rather
            // than failing the rename the user asked for.
            useAppLogStore
                .getState()
                .log('error', `The route for "${oldView}" could not follow the rename: ${errorMessage(err)}`);
        }
    }, [enabled, project.path, refresh]);
    return {
        routes,
        busy,
        openRoute,
        setRender,
        generateRoute,
        ensureRoute,
        renameRouteView,
    };
};
