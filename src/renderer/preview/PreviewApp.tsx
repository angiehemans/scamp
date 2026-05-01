import { useEffect, useRef, useState } from 'react';
import type { DevServerStatus } from '@shared/types';
import { pageNameToRoute, previewUrl } from './route';
import {
  PreviewToolbar,
  viewportCss,
  type ViewportWidth,
} from './PreviewToolbar';
import styles from './PreviewApp.module.css';

/**
 * Preview window's React shell. Subscribes to dev-server status
 * pushed from main; renders an install/start panel until the
 * server reaches `ready`, then mounts an Electron `<webview>` that
 * loads the live dev-server URL.
 */
export const PreviewApp = (): JSX.Element => {
  const [status, setStatus] = useState<DevServerStatus>({ kind: 'idle' });
  const [projectPath, setProjectPath] = useState<string>('');
  const [pageName, setPageName] = useState<string>('home');
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [viewportWidth, setViewportWidth] = useState<ViewportWidth>({
    kind: 'fullscreen',
  });
  // The cast preserves React's WebViewHTMLAttributes typing while
  // letting us use the broader EventTarget API for `addEventListener`
  // / `goBack` / `reload`.
  const webviewRef = useRef<HTMLElement | null>(null);
  const previewApi: typeof window.scampPreview | undefined = window.scampPreview;

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (hash.length > 0) setProjectPath(decodeURIComponent(hash));
  }, []);

  useEffect(() => {
    if (!previewApi) return;
    const off = previewApi.onStatusChanged((payload) => {
      setProjectPath(payload.projectPath);
      setStatus(payload.status);
    });
    return off;
  }, [previewApi]);

  // Pull the current status explicitly on mount. Push events from
  // main can be lost if they fire before the renderer attaches its
  // listener (race between window creation and first paint).
  // The hash-derived projectPath is the source of truth here since
  // it's set synchronously from the URL fragment.
  useEffect(() => {
    if (!previewApi) return;
    const hash = window.location.hash.replace(/^#/, '');
    const path = hash.length > 0 ? decodeURIComponent(hash) : '';
    if (path.length === 0) return;
    void previewApi.getStatus(path).then((s) => {
      setStatus(s);
    });
  }, [previewApi]);

  useEffect(() => {
    if (!previewApi) return;
    const off = previewApi.onNavigate((payload) => {
      setPageName(payload.pageName);
    });
    return off;
  }, [previewApi]);

  // Defensive fallback: if the preload didn't load (build / path
  // misconfiguration), render an explicit error so the user sees
  // something concrete instead of a blank window.
  if (!previewApi) {
    return (
      <div className={styles.app}>
        <main className={styles.body}>
          <div className={styles.statusPanel}>
            <h2 className={styles.crashed}>Preview preload failed to load.</h2>
            <p className={styles.statusHint}>
              <code>window.scampPreview</code> is undefined. The preview
              preload didn&apos;t load — check the BrowserWindow&apos;s
              <code>preload</code> path in main.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Narrow the dep set to the scalar bits the navigation actually
  // cares about. Depending on the whole `status` object would refire
  // this effect every time main pushes a new status push (each log
  // line during install/start), and the same-URL `setAttribute` call
  // would cancel the in-flight load with ERR_ABORTED.
  const port = status.kind === 'ready' ? status.port : null;
  useEffect(() => {
    if (port === null) return;
    const node = webviewRef.current;
    if (!node) return;
    const url = previewUrl(port, pageNameToRoute(pageName));
    // Guard against same-URL re-navigation. The webview is also
    // navigated by the user (in-app links) and we shouldn't yank
    // them back here — only initialise / page-switch updates the
    // URL via this effect.
    if (node.getAttribute('src') === url) return;
    node.setAttribute('src', url);
    setCurrentUrl(url);
  }, [port, pageName]);

  // Watch the webview for navigation events so the URL bar and
  // back/forward enabled state stay in sync.
  useEffect(() => {
    const node = webviewRef.current;
    if (!node) return;
    const refreshHistory = (): void => {
      // Both methods are exposed on the webview tag at runtime.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wv = node as unknown as {
        canGoBack: () => boolean;
        canGoForward: () => boolean;
      };
      try {
        setCanGoBack(wv.canGoBack());
        setCanGoForward(wv.canGoForward());
      } catch {
        // Webview not yet attached — ignore until the next event.
      }
    };
    const handleNavigate = (e: Event): void => {
      const ev = e as Event & { url?: string };
      if (typeof ev.url === 'string') setCurrentUrl(ev.url);
      refreshHistory();
    };
    node.addEventListener('did-navigate', handleNavigate);
    node.addEventListener('did-navigate-in-page', handleNavigate);
    node.addEventListener('did-finish-load', refreshHistory);
    return () => {
      node.removeEventListener('did-navigate', handleNavigate);
      node.removeEventListener('did-navigate-in-page', handleNavigate);
      node.removeEventListener('did-finish-load', refreshHistory);
    };
  }, [status.kind]); // re-bind when the webview is (re)mounted

  const handleBack = (): void => {
    const node = webviewRef.current;
    if (!node) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node as unknown as { goBack: () => void }).goBack();
  };
  const handleForward = (): void => {
    const node = webviewRef.current;
    if (!node) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node as unknown as { goForward: () => void }).goForward();
  };
  const handleReload = (): void => {
    if (status.kind === 'crashed') {
      void window.scampPreview.restart(projectPath);
      return;
    }
    const node = webviewRef.current;
    if (!node) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node as unknown as { reload: () => void }).reload();
  };
  const handleOpenDevTools = (): void => {
    const node = webviewRef.current;
    if (!node) return;
    // `openDevTools` is on the webview tag at runtime — opens
    // Chromium DevTools attached to the embedded page.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node as unknown as { openDevTools: () => void }).openDevTools();
  };

  return (
    <div className={styles.app}>
      <PreviewToolbar
        url={currentUrl}
        statusKind={status.kind}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        viewportWidth={viewportWidth}
        onBack={handleBack}
        onForward={handleForward}
        onReload={handleReload}
        onOpenDevTools={handleOpenDevTools}
        onViewportChange={setViewportWidth}
      />
      <main className={styles.body}>
        {status.kind === 'ready' ? (
          <div
            className={styles.viewportFrame}
            style={{ width: viewportCss(viewportWidth) }}
          >
            <webview
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ref={webviewRef as any}
              className={styles.webview}
              partition={`persist:scamp-preview-${encodeURIComponent(projectPath)}`}
              // React warns about non-string boolean attributes on
              // unknown elements; the empty-string form is what
              // Electron's <webview> recognises.
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              {...({ allowpopups: '' } as any)}
            />
          </div>
        ) : (
          <StatusView status={status} projectPath={projectPath} />
        )}
      </main>
    </div>
  );
};

const StatusView = ({
  status,
  projectPath,
}: {
  status: DevServerStatus;
  projectPath: string;
}): JSX.Element => {
  if (status.kind === 'idle') {
    return <div className={styles.placeholder}>Waiting for the dev server…</div>;
  }
  if (status.kind === 'installing') {
    return (
      <div className={styles.statusPanel}>
        <Spinner />
        <h2>Installing dependencies…</h2>
        <p className={styles.statusHint}>
          First-time setup — this only happens once per project. Subsequent
          previews start instantly.
        </p>
        <LogTail logs={status.logs} />
      </div>
    );
  }
  if (status.kind === 'starting') {
    return (
      <div className={styles.statusPanel}>
        <Spinner />
        <h2>Starting dev server…</h2>
        <p className={styles.statusHint}>Listening on port {status.port}.</p>
        <LogTail logs={status.logs} />
      </div>
    );
  }
  if (status.kind === 'crashed') {
    return (
      <div className={styles.statusPanel}>
        <h2 className={styles.crashed}>
          Dev server crashed (exit {status.exitCode})
        </h2>
        <LogTail logs={status.logs} />
        <button
          type="button"
          className={styles.restartBtn}
          onClick={() => void window.scampPreview.restart(projectPath)}
        >
          Restart server
        </button>
      </div>
    );
  }
  // ready handled by caller — defensive fallback
  return null as unknown as JSX.Element;
};

const Spinner = (): JSX.Element => <div className={styles.spinner} />;

const LogTail = ({ logs }: { logs: ReadonlyArray<string> }): JSX.Element => {
  const tail = logs.slice(-50);
  if (tail.length === 0) return <div className={styles.logsEmpty}>No output yet.</div>;
  return <pre className={styles.logs}>{tail.join('\n')}</pre>;
};
