import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { viewSlugFor } from '@shared/templates';
import { Section } from '../sections/Section';
import { Tooltip } from '../controls/Tooltip';
import styles from './RoutesSection.module.css';
const RENDER_MODES = ['static', 'server', 'client'];
const RENDER_HELP = {
    static: 'Prerendered at build: HTML and CSS, no JavaScript unless a view has events',
    server: 'Rendered per request by the server; needs an adapter to deploy',
    client: 'Prerendered, then runs in the browser',
};
/**
 * The Routes section of a Scamp-framework project: every file under
 * routes/, its render mode, and Generate route for a view no route
 * renders yet. The framework owns the routes; the app lists them and
 * writes only the `render` export and a generated file.
 *
 * It sits in the properties panel's empty state, above the keyboard
 * shortcuts: a route is page-level, so it belongs with what that panel
 * shows when no element is selected.
 * see docs/notes/routes-in-the-app.md
 */
export const RoutesSection = ({ routes, views, busy, onOpen, onSetRender, onGenerate }) => {
    const rendered = new Set(routes.filter((r) => r.kind === 'page').map((r) => r.view));
    const unrouted = views.filter((v) => !rendered.has(v.name));
    return (_jsx("div", { "data-testid": "routes-section", children: _jsxs(Section, { title: "Routes", collapsible: true, defaultOpen: true, children: [routes.length === 0 && unrouted.length === 0 && (_jsx("p", { className: styles.empty, children: "No routes yet. Add a page to get a view, then generate its route." })), _jsxs("ul", { className: styles.list, children: [routes.map((route) => (_jsxs("li", { className: styles.routeRow, "data-testid": `route-${route.file}`, children: [_jsx(Tooltip, { label: `routes/${route.file} — open in the code panel`, children: _jsxs("button", { type: "button", className: styles.routeButton, onClick: () => onOpen(route.file), children: [route.path, _jsx("span", { className: styles.routeKind, children: route.kind === 'api' ? 'api' : (route.view ?? '') })] }) }), route.kind === 'page' && (_jsx("div", { className: styles.render, role: "group", "aria-label": `Render mode for ${route.path}`, children: RENDER_MODES.map((mode) => (_jsx(Tooltip, { label: RENDER_HELP[mode], children: _jsx("button", { type: "button", className: styles.renderOption, "aria-pressed": route.render === mode, disabled: busy, onClick: () => {
                                                if (route.render !== mode)
                                                    onSetRender(route.file, mode);
                                            }, children: mode }) }, mode))) }))] }, route.file))), unrouted.map((view) => (_jsxs("li", { className: styles.generate, "data-testid": `generate-${view.name}`, children: [_jsxs("span", { children: ["/", viewSlugFor(view.name) === 'home' ? '' : viewSlugFor(view.name)] }), _jsx(Tooltip, { label: `Write routes/${viewSlugFor(view.name) === 'home' ? 'index' : viewSlugFor(view.name)}.tsx with a load() that returns this view's sample data`, children: _jsx("button", { type: "button", className: styles.generateButton, disabled: busy, onClick: () => onGenerate(view.name), children: "Generate route" }) })] }, `gen:${view.name}`)))] })] }) }));
};
