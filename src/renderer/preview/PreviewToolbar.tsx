import { useState } from 'react';
import type { DevServerStatus } from '@shared/types';
import styles from './PreviewToolbar.module.css';

export type ViewportWidth =
  | { kind: 'mobile' }
  | { kind: 'tablet' }
  | { kind: 'desktop' }
  | { kind: 'fullscreen' }
  | { kind: 'custom'; px: number };

type Props = {
  url: string;
  /** Dev-server lifecycle kind. Surfaced as a small chip so a stuck
   *  preview is visibly diagnostic. */
  statusKind: DevServerStatus['kind'];
  canGoBack: boolean;
  canGoForward: boolean;
  viewportWidth: ViewportWidth;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  onOpenDevTools: () => void;
  onViewportChange: (width: ViewportWidth) => void;
};

const STATUS_LABEL: Record<DevServerStatus['kind'], string> = {
  idle: 'Idle',
  installing: 'Installing…',
  starting: 'Starting…',
  ready: 'Ready',
  crashed: 'Crashed',
};

const PRESET_BUTTONS: ReadonlyArray<{
  label: string;
  width: ViewportWidth;
  px: number | null;
}> = [
  { label: 'Mobile', width: { kind: 'mobile' }, px: 390 },
  { label: 'Tablet', width: { kind: 'tablet' }, px: 768 },
  { label: 'Desktop', width: { kind: 'desktop' }, px: 1440 },
  { label: 'Fullscreen', width: { kind: 'fullscreen' }, px: null },
];

const isSamePreset = (a: ViewportWidth, b: ViewportWidth): boolean =>
  a.kind === b.kind;

export const PreviewToolbar = ({
  url,
  statusKind,
  canGoBack,
  canGoForward,
  viewportWidth,
  onBack,
  onForward,
  onReload,
  onOpenDevTools,
  onViewportChange,
}: Props): JSX.Element => {
  const [copied, setCopied] = useState(false);
  const [customDraft, setCustomDraft] = useState('');

  const handleCopy = async (): Promise<void> => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard API blocked — fall through silently.
    }
  };

  const handleCustomCommit = (): void => {
    const px = parseInt(customDraft, 10);
    if (!Number.isFinite(px) || px <= 0) return;
    onViewportChange({ kind: 'custom', px });
  };

  return (
    <header className={styles.toolbar}>
      <div className={styles.navGroup}>
        <button
          type="button"
          className={styles.navBtn}
          onClick={onBack}
          disabled={!canGoBack}
          title="Back"
          aria-label="Back"
        >
          ←
        </button>
        <button
          type="button"
          className={styles.navBtn}
          onClick={onForward}
          disabled={!canGoForward}
          title="Forward"
          aria-label="Forward"
        >
          →
        </button>
        <button
          type="button"
          className={styles.navBtn}
          onClick={onReload}
          title="Reload"
          aria-label="Reload"
        >
          ↺
        </button>
      </div>

      <div className={styles.urlGroup}>
        <span className={styles.urlBar} title={url}>
          {url || '—'}
        </span>
        <button
          type="button"
          className={styles.copyBtn}
          onClick={() => void handleCopy()}
          title="Copy URL"
          aria-label="Copy URL"
          disabled={!url}
        >
          {copied ? '✓' : '⧉'}
        </button>
      </div>

      <span
        className={`${styles.statusChip} ${styles[`statusChip_${statusKind}`] ?? ''}`}
        title={`Dev server status: ${STATUS_LABEL[statusKind]}`}
      >
        {STATUS_LABEL[statusKind]}
      </span>

      <button
        type="button"
        className={styles.navBtn}
        onClick={onOpenDevTools}
        disabled={statusKind !== 'ready'}
        title="Open browser DevTools for the preview"
        aria-label="Open DevTools"
      >
        ⚙
      </button>

      <div className={styles.viewportGroup} role="radiogroup" aria-label="Viewport width">
        {PRESET_BUTTONS.map(({ label, width, px }) => {
          const active = isSamePreset(viewportWidth, width);
          return (
            <button
              type="button"
              key={width.kind}
              role="radio"
              aria-checked={active}
              className={`${styles.viewportBtn} ${active ? styles.viewportBtnActive : ''}`}
              onClick={() => onViewportChange(width)}
              title={px === null ? 'Fill the window' : `${px}px wide`}
            >
              {label}
            </button>
          );
        })}
        <input
          type="text"
          inputMode="numeric"
          className={`${styles.viewportInput} ${
            viewportWidth.kind === 'custom' ? styles.viewportInputActive : ''
          }`}
          placeholder="Custom"
          value={
            viewportWidth.kind === 'custom'
              ? String(viewportWidth.px)
              : customDraft
          }
          onChange={(e) => setCustomDraft(e.target.value)}
          onBlur={handleCustomCommit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
          title="Custom width in pixels"
        />
      </div>
    </header>
  );
};

/** Resolve a `ViewportWidth` to the wrapper width in CSS units.
 *  Fullscreen uses `100%`; everything else is fixed pixels. */
export const viewportCss = (vp: ViewportWidth): string => {
  if (vp.kind === 'fullscreen') return '100%';
  if (vp.kind === 'mobile') return '390px';
  if (vp.kind === 'tablet') return '768px';
  if (vp.kind === 'desktop') return '1440px';
  return `${vp.px}px`;
};
