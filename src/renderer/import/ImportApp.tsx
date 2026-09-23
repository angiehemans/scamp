import { useCallback, useEffect, useRef, useState } from 'react';

import { captureFn, capturePolicy, prepareFn } from '@shared/captureScript';
import type { ImportResultPayload } from '@shared/types';

import styles from './ImportApp.module.css';

/**
 * The import window: a URL bar, a page, and an Import button.
 *
 * The capture runs here rather than in main, because `executeJavaScript`
 * on the `<webview>` tag is what reaches the live document — and the
 * live document, after cascade and scripts, is the thing worth reading.
 * What comes back is handed straight to main; this window never sees a
 * project, a file, or the element model.
 * see docs/plans/website-import-plan.md
 */

type Status =
  | { kind: 'idle' }
  | { kind: 'capturing' }
  | { kind: 'done'; result: ImportResultPayload }
  | { kind: 'failed'; message: string };

/** `https://` in front of a bare host, so typing `stripe.com` works. */
const normalizeUrl = (raw: string): string => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

export const ImportApp = (): JSX.Element => {
  const webviewRef = useRef<HTMLElement | null>(null);
  const [projectPath, setProjectPath] = useState<string>('');
  const [draftUrl, setDraftUrl] = useState('');
  const [loadedUrl, setLoadedUrl] = useState('');
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  /**
   * The `<webview>` tag's methods — `executeJavaScript` among them —
   * only exist once it has emitted `dom-ready`. Before that the element
   * is in the DOM and the calls are not there, which reads exactly like
   * a button that does nothing.
   */
  const [webviewReady, setWebviewReady] = useState(false);

  useEffect(() => {
    const offOpen = window.scampImport.onOpen((args) => {
      setProjectPath(args.projectPath);
      if (args.url) {
        setDraftUrl(args.url);
        setLoadedUrl(normalizeUrl(args.url));
      }
    });
    const offResult = window.scampImport.onResult((result) => {
      setStatus({ kind: 'done', result });
    });
    return () => {
      offOpen();
      offResult();
    };
  }, []);

  // Keep the URL bar and the history buttons in step with the page.
  useEffect(() => {
    const node = webviewRef.current;
    if (!node) return;
    const wv = node as unknown as {
      canGoBack: () => boolean;
      canGoForward: () => boolean;
    };
    const refresh = (): void => {
      try {
        setCanGoBack(wv.canGoBack());
        setCanGoForward(wv.canGoForward());
      } catch {
        // Not attached yet; the next event will do it.
      }
    };
    const onNavigate = (e: Event): void => {
      const url = (e as Event & { url?: string }).url;
      if (typeof url === 'string') setDraftUrl(url);
      // A new page invalidates the last import's verdict.
      setStatus((s) => (s.kind === 'idle' ? s : { kind: 'idle' }));
      refresh();
    };
    const onDomReady = (): void => setWebviewReady(true);
    node.addEventListener('dom-ready', onDomReady);
    node.addEventListener('did-navigate', onNavigate);
    node.addEventListener('did-navigate-in-page', onNavigate);
    node.addEventListener('did-finish-load', refresh);
    return () => {
      node.removeEventListener('dom-ready', onDomReady);
      node.removeEventListener('did-navigate', onNavigate);
      node.removeEventListener('did-navigate-in-page', onNavigate);
      node.removeEventListener('did-finish-load', refresh);
    };
  }, [loadedUrl]);

  const handleGo = useCallback((): void => {
    const next = normalizeUrl(draftUrl);
    if (next.length === 0) return;
    setWebviewReady(false);
    setLoadedUrl(next);
    const node = webviewRef.current as unknown as { loadURL?: (u: string) => void } | null;
    // Already mounted: navigate it. First load: the `src` does it.
    if (node?.loadURL) node.loadURL(next);
  }, [draftUrl]);

  const handleImport = useCallback(async (): Promise<void> => {
    const node = webviewRef.current as unknown as {
      executeJavaScript?: (code: string) => Promise<unknown>;
    } | null;
    if (!node?.executeJavaScript || projectPath.length === 0) {
      setStatus({
        kind: 'failed',
        message: 'The page is not ready to read yet — wait for it to finish loading.',
      });
      return;
    }
    setStatus({ kind: 'capturing' });
    try {
      // The capture function is serialized and evaluated in the page,
      // with the policy passed in as data — it cannot import anything
      // once it is over there.
      // Scroll the page through first: content that reveals on scroll is
      // recorded invisible otherwise, which reads as missing.
      await node.executeJavaScript(`(${prepareFn.toString()})()`);
      const source = `(${captureFn.toString()})(${JSON.stringify(capturePolicy())})`;
      const payload = await node.executeJavaScript(source);
      const sent = await window.scampImport.deliver(projectPath, payload);
      if (!sent.ok) {
        setStatus({ kind: 'failed', message: sent.error ?? 'Scamp could not take the page.' });
      }
      // On success the app window answers over `onResult`.
    } catch (err) {
      setStatus({
        kind: 'failed',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [projectPath]);

  const nav = (method: 'goBack' | 'goForward' | 'reload') => (): void => {
    const node = webviewRef.current as unknown as Record<string, (() => void) | undefined> | null;
    node?.[method]?.();
  };

  const busy = status.kind === 'capturing';

  return (
    <div className={styles.shell}>
      <div className={styles.toolbar}>
        <button className={styles.navBtn} onClick={nav('goBack')} disabled={!canGoBack} title="Back">‹</button>
        <button className={styles.navBtn} onClick={nav('goForward')} disabled={!canGoForward} title="Forward">›</button>
        <button className={styles.navBtn} onClick={nav('reload')} disabled={!loadedUrl} title="Reload">⟳</button>
        <input
          className={styles.urlBar}
          value={draftUrl}
          onChange={(e) => setDraftUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleGo();
          }}
          placeholder="Paste a URL, then navigate to the page you want"
          spellCheck={false}
          aria-label="Address"
        />
        <button
          className={styles.importBtn}
          onClick={() => void handleImport()}
          disabled={!loadedUrl || !webviewReady || busy || projectPath.length === 0}
        >
          {busy ? 'Reading the page…' : 'Import'}
        </button>
      </div>

      {status.kind !== 'idle' && status.kind !== 'capturing' && (
        <div
          className={`${styles.banner} ${
            status.kind === 'failed' || !status.result?.ok ? styles.bannerBad : styles.bannerGood
          }`}
        >
          {status.kind === 'failed' ? (
            <span>{status.message}</span>
          ) : status.result.ok ? (
            <span>
              Imported <strong>{status.result.viewName}</strong> —{' '}
              {status.result.elementCount} elements
              {status.result.findings && status.result.findings.length > 0 && (
                <span className={styles.findings}>
                  {' '}· {status.result.findings.length} things didn&apos;t come across:{' '}
                  {status.result.findings.slice(0, 3).join('; ')}
                  {status.result.findings.length > 3 ? ' …' : ''}
                </span>
              )}
            </span>
          ) : (
            <span>{status.result.error ?? 'The import failed.'}</span>
          )}
        </div>
      )}

      <div className={styles.viewport}>
        {loadedUrl ? (
          <webview
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ref={webviewRef as any}
            src={loadedUrl}
            className={styles.webview}
          />
        ) : (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>Import a page</p>
            <p className={styles.emptyBody}>
              Paste a URL above and navigate to the page you want. Clicking
              <strong> Import</strong> reads the page as it is on screen and
              makes a new view from it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
