import type { ComponentFile, RouteFile, RouteRender } from '@shared/types';
import { viewSlugFor } from '@shared/templates';

import { Tooltip } from '../controls/Tooltip';
import styles from './RoutesSection.module.css';

type Props = {
  routes: ReadonlyArray<RouteFile>;
  /** Views in the project; those no page route renders get a Generate action. */
  views: ReadonlyArray<ComponentFile>;
  busy: boolean;
  onOpen: (file: string) => void;
  onSetRender: (file: string, render: RouteRender) => void;
  onGenerate: (viewName: string) => void;
};

const RENDER_MODES: ReadonlyArray<RouteRender> = ['static', 'server', 'client'];

const RENDER_HELP: Record<RouteRender, string> = {
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
export const RoutesSection = ({ routes, views, busy, onOpen, onSetRender, onGenerate }: Props): JSX.Element => {
  const rendered = new Set(routes.filter((r) => r.kind === 'page').map((r) => r.view));
  const unrouted = views.filter((v) => !rendered.has(v.name));
  return (
    <div className={styles.wrap} data-testid="routes-section">
      <h3 className={styles.title}>Routes</h3>
      {routes.length === 0 && unrouted.length === 0 && (
        <p className={styles.empty}>No routes yet. Add a page to get a view, then generate its route.</p>
      )}
      <ul className={styles.list}>
        {routes.map((route) => (
          <li key={route.file} className={styles.routeRow} data-testid={`route-${route.file}`}>
            <Tooltip label={`routes/${route.file} — open in the code panel`}>
              <button type="button" className={styles.routeButton} onClick={() => onOpen(route.file)}>
                {route.path}
                <span className={styles.routeKind}>{route.kind === 'api' ? 'api' : (route.view ?? '')}</span>
              </button>
            </Tooltip>
            {route.kind === 'page' && (
              <div className={styles.render} role="group" aria-label={`Render mode for ${route.path}`}>
                {RENDER_MODES.map((mode) => (
                  <Tooltip key={mode} label={RENDER_HELP[mode]}>
                    <button
                      type="button"
                      className={styles.renderOption}
                      aria-pressed={route.render === mode}
                      disabled={busy}
                      onClick={() => {
                        if (route.render !== mode) onSetRender(route.file, mode);
                      }}
                    >
                      {mode}
                    </button>
                  </Tooltip>
                ))}
              </div>
            )}
          </li>
        ))}
        {unrouted.map((view) => (
          <li key={`gen:${view.name}`} className={styles.generate} data-testid={`generate-${view.name}`}>
            <span>/{viewSlugFor(view.name) === 'home' ? '' : viewSlugFor(view.name)}</span>
            <Tooltip label={`Write routes/${viewSlugFor(view.name) === 'home' ? 'index' : viewSlugFor(view.name)}.tsx with a load() that returns this view's sample data`}>
              <button type="button" className={styles.generateButton} disabled={busy} onClick={() => onGenerate(view.name)}>
                Generate route
              </button>
            </Tooltip>
          </li>
        ))}
      </ul>
    </div>
  );
};
