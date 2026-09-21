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
 * The rows: a route's path with its render mode under it, and a
 * Generate action per view nothing renders. Shared by the sidebar
 * section and the project settings page so the two can't drift.
 */
export const RouteList = ({ routes, unrouted, busy, onOpen, onSetRender, onGenerate, }) => (_jsxs("ul", { className: styles.list, children: [routes.map((route) => (_jsxs("li", { className: styles.routeRow, "data-testid": `route-${route.file}`, children: [_jsx(Tooltip, { label: `routes/${route.file} — open in the code panel`, children: _jsxs("button", { type: "button", className: styles.routeButton, onClick: () => onOpen(route.file), children: [route.path, _jsx("span", { className: styles.routeKind, children: route.kind === 'api' ? 'api' : (route.view ?? '') })] }) }), route.kind === 'page' && (_jsx("div", { className: styles.render, role: "group", "aria-label": `Render mode for ${route.path}`, children: RENDER_MODES.map((mode) => (_jsx(Tooltip, { label: RENDER_HELP[mode], children: _jsx("button", { type: "button", className: styles.renderOption, "aria-pressed": route.render === mode, disabled: busy, onClick: () => {
                                if (route.render !== mode)
                                    onSetRender(route.file, mode);
                            }, children: mode }) }, mode))) }))] }, route.file))), unrouted.map((view) => (_jsxs("li", { className: styles.generate, "data-testid": `generate-${view.name}`, children: [_jsxs("span", { children: ["/", viewSlugFor(view.name) === 'home' ? '' : viewSlugFor(view.name)] }), _jsx(Tooltip, { label: `Write routes/${viewSlugFor(view.name) === 'home' ? 'index' : viewSlugFor(view.name)}.tsx with a load() that returns this view's sample data`, children: _jsx("button", { type: "button", className: styles.generateButton, disabled: busy, onClick: () => onGenerate(view.name), children: "Generate route" }) })] }, `gen:${view.name}`)))] }));
export const RoutesSection = ({ routes, views, activeViewName, busy, onOpen, onSetRender, onGenerate, }) => {
    const pageRoutes = activeViewName === null
        ? []
        : routes.filter((r) => r.kind === 'page' && r.view === activeViewName);
    const rendered = new Set(routes.filter((r) => r.kind === 'page').map((r) => r.view));
    const unrouted = views.filter((v) => v.name === activeViewName && !rendered.has(v.name));
    return (_jsx("div", { "data-testid": "routes-section", children: _jsxs(Section, { title: "Routes", collapsible: true, defaultOpen: true, children: [activeViewName === null && (_jsx("p", { className: styles.empty, children: "Open a page to see its route." })), activeViewName !== null && pageRoutes.length === 0 && unrouted.length === 0 && (_jsx("p", { className: styles.empty, children: "No route renders this page yet." })), _jsx(RouteList, { routes: pageRoutes, unrouted: unrouted, busy: busy, onOpen: onOpen, onSetRender: onSetRender, onGenerate: onGenerate })] }) }));
};
/** Every route in the project, for the settings page. */
export const allUnroutedViews = (routes, views) => {
    const rendered = new Set(routes.filter((r) => r.kind === 'page').map((r) => r.view));
    return views.filter((v) => !rendered.has(v.name));
};
