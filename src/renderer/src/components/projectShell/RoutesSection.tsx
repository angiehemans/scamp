import type { ComponentFile, RouteFile, RouteRender } from '@shared/types';
import { viewSlugFor } from '@shared/templates';

import { Section } from '../sections/Section';
import { Tooltip } from '../controls/Tooltip';
import styles from './RoutesSection.module.css';

type Props = {
  routes: ReadonlyArray<RouteFile>;
  /** Views in the project; those no page route renders get a Generate action. */
  views: ReadonlyArray<ComponentFile>;
  /** The view open on the canvas. The section shows its routes alone. */
  activeViewName: string | null;
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
 * The Routes section of a Scamp-framework project: the routes that
 * render the open page, their render mode, and Generate route when the
 * page has none yet. The framework owns the routes; the app lists them
 * and writes only the `render` export and a generated file.
 *
 * It shows the open page's routes rather than the project's. The
 * section sits in the properties panel's empty state, which is about
 * the page in front of you — a list of every route in the project
 * belongs to a project view, not to this one.
 * see docs/notes/routes-in-the-app.md
 */
export const RoutesSection = ({
  routes,
  views,
  activeViewName,
  busy,
  onOpen,
  onSetRender,
  onGenerate,
}: Props): JSX.Element => {
  const pageRoutes =
    activeViewName === null
      ? []
      : routes.filter((r) => r.kind === 'page' && r.view === activeViewName);
  const rendered = new Set(routes.filter((r) => r.kind === 'page').map((r) => r.view));
  const unrouted = views.filter(
    (v) => v.name === activeViewName && !rendered.has(v.name)
  );
  return (
    <div data-testid="routes-section">
      <Section title="Routes" collapsible defaultOpen>
        {activeViewName === null && (
          <p className={styles.empty}>Open a page to see its route.</p>
        )}
        {activeViewName !== null && pageRoutes.length === 0 && unrouted.length === 0 && (
          <p className={styles.empty}>No route renders this page yet.</p>
        )}
        <ul className={styles.list}>
          {pageRoutes.map((route) => (
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
      </Section>
    </div>
  );
};
