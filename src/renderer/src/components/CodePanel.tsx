import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { css as cssLang } from '@codemirror/lang-css';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { useCanvasStore } from '@store/canvasSlice';
import { Tooltip } from './controls/Tooltip';
import styles from './CodePanel.module.css';

const READ_ONLY = EditorView.editable.of(false);

/**
 * Bottom code panel: read-only live view of the active page's TSX + CSS.
 *
 * The content is sourced from `pageSource` in the canvas store, which the
 * sync bridge keeps fresh on both canvas-driven writes and external
 * file changes. So whatever's on disk is whatever's in the panel.
 */
export const CodePanel = (): JSX.Element => {
  const activePage = useCanvasStore((s) => s.activePage);
  const pageSource = useCanvasStore((s) => s.pageSource);
  const setBottomPanel = useCanvasStore((s) => s.setBottomPanel);

  const tsx = pageSource?.tsx ?? '';
  const css = pageSource?.css ?? '';

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Code</span>
        <span className={styles.spacer} />
        <Tooltip label="Hide code panel">
          <button
            className={styles.closeButton}
            onClick={() => setBottomPanel('none')}
            type="button"
          >
            ×
          </button>
        </Tooltip>
      </div>
      <div className={styles.split}>
        <div className={styles.pane}>
          <div className={styles.paneHeader}>
            <code>{activePage ? `${activePage.name}.tsx` : '— no page —'}</code>
          </div>
          <div className={styles.editorWrap}>
            <CodeMirror
              value={tsx}
              height="100%"
              theme={oneDark}
              extensions={[javascript({ jsx: true, typescript: true }), READ_ONLY]}
              basicSetup={{
                lineNumbers: true,
                foldGutter: false,
                highlightActiveLine: false,
              }}
            />
          </div>
        </div>
        <div className={styles.pane}>
          <div className={styles.paneHeader}>
            <code>{activePage ? `${activePage.name}.module.css` : '— no page —'}</code>
          </div>
          <div className={styles.editorWrap}>
            <CodeMirror
              value={css}
              height="100%"
              theme={oneDark}
              extensions={[cssLang(), READ_ONLY]}
              basicSetup={{
                lineNumbers: true,
                foldGutter: false,
                highlightActiveLine: false,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
