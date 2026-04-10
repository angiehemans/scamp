import { useEffect, useMemo, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { css as cssLang } from '@codemirror/lang-css';
import { autocompletion } from '@codemirror/autocomplete';
import { oneDark } from '@codemirror/theme-one-dark';
import { useCanvasStore } from '@store/canvasSlice';
import { elementDeclarationLines, classNameFor } from '@lib/generateCode';
import { createCssCompletion } from '@lib/cssCompletion';
import type { ScampElement } from '@lib/element';
import styles from './PropertiesPanel.module.css';

const buildClassBody = (el: ScampElement, parent: ScampElement | null): string => {
  return elementDeclarationLines(el, parent).join('\n');
};

/**
 * The (className, cssPath) pair the editor was loaded against. Tracked in
 * a ref so the commit path always writes to the element that was being
 * edited — never to whatever happens to be selected at blur time.
 */
type EditTarget = {
  className: string;
  cssPath: string;
};

/**
 * The raw CSS editor view of the properties panel. Extracted from the
 * old `PropertiesPanel.tsx` so the new router can mount it conditionally
 * alongside the typed `UiPanel`.
 */
export const CssPanel = (): JSX.Element => {
  // Multi-select: the panel always edits the FIRST selected element so the
  // user has a single, predictable target. The other selected elements
  // still highlight on the canvas — they're just not editable here.
  const selectedId = useCanvasStore((s) => s.selectedElementIds[0] ?? null);
  const element = useCanvasStore((s) => {
    const id = s.selectedElementIds[0];
    return id ? s.elements[id] : undefined;
  });
  const parentElement = useCanvasStore((s) => {
    const id = s.selectedElementIds[0];
    const el = id ? s.elements[id] : undefined;
    if (!el || !el.parentId) return null;
    return s.elements[el.parentId] ?? null;
  });
  const activePage = useCanvasStore((s) => s.activePage);
  const themeTokens = useCanvasStore((s) => s.themeTokens);

  // Rebuild CodeMirror extensions when theme tokens change so the
  // autocomplete source always has the latest var(--name) suggestions.
  const cssExtensions = useMemo(
    () => [
      cssLang(),
      autocompletion({
        override: [createCssCompletion(() => themeTokens)],
        activateOnTyping: true,
        closeOnBlur: true,
      }),
    ],
    [themeTokens]
  );

  const editorBody = useMemo(
    () => (element ? buildClassBody(element, parentElement) : ''),
    [element, parentElement]
  );
  const [draft, setDraft] = useState(editorBody);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSelectedId = useRef<string | null>(null);

  // ---- Refs that escape React's render closures -------------------------
  // The blur-driven commit path runs AFTER the panel has re-rendered with
  // the next selection, so reading state via render-time closures gives
  // the wrong target. We mirror everything commit() needs into refs that
  // only update when we deliberately load a new edit target.

  const dirtyRef = useRef(false);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const draftRef = useRef('');
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  // The (className, cssPath) the editor is currently bound to. Updated only
  // by the load effect — NOT every render — so commit() always patches
  // the element the user was actually editing.
  const editTargetRef = useRef<EditTarget | null>(null);

  /**
   * Patch the active edit target with the current draft. Used by both the
   * blur path and the selection-change flush. Reads everything from refs
   * because by the time it runs the React closure may already point at a
   * different element.
   */
  const flushDraft = async (): Promise<void> => {
    const target = editTargetRef.current;
    if (!target) return;
    if (!dirtyRef.current) return;
    try {
      await window.scamp.patchFile({
        cssPath: target.cssPath,
        className: target.className,
        newDeclarations: draftRef.current,
      });
      setDirty(false);
      dirtyRef.current = false;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // Reload the draft when the selection or its underlying element changes,
  // but never when only the local dirty/error flags flip. The dirty ref
  // gates whether we overwrite an in-progress edit; selection changes
  // first flush any pending edit to the OLD target.
  useEffect(() => {
    const selectionChanged = lastSelectedId.current !== selectedId;

    if (selectionChanged) {
      // Flush whatever was being edited to its original target before we
      // load the new one. Fire-and-forget — the chokidar round-trip will
      // refresh the new selection's draft once the file lands.
      if (dirtyRef.current && editTargetRef.current) {
        void flushDraft();
      }

      lastSelectedId.current = selectedId;
      setDraft(editorBody);
      setDirty(false);
      dirtyRef.current = false;
      setError(null);

      // Bind the editor to the new target. From here on, commit() will
      // write to this className/cssPath until the next selection change.
      if (element && activePage) {
        editTargetRef.current = {
          className: classNameFor(element),
          cssPath: activePage.cssPath,
        };
      } else {
        editTargetRef.current = null;
      }
      return;
    }

    // Same selection — sync the draft from the parsed round-trip if the
    // user hasn't started typing yet.
    if (!dirtyRef.current) {
      setDraft(editorBody);
    }
    // Refresh the cssPath / className in case activePage swapped under us
    // (e.g. switching pages without changing the selection within the
    // page tree).
    if (element && activePage) {
      editTargetRef.current = {
        className: classNameFor(element),
        cssPath: activePage.cssPath,
      };
    }
    // We deliberately don't depend on `element`/`activePage` directly:
    // editorBody already changes whenever the element does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorBody, selectedId]);

  if (!element || !selectedId) return <></>;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      void flushDraft();
    }
  };

  return (
    <>
      <div className={styles.editorWrap} onBlur={() => void flushDraft()} onKeyDown={handleKeyDown}>
        <CodeMirror
          value={draft}
          height="100%"
          theme={oneDark}
          extensions={cssExtensions}
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLine: false,
            autocompletion: true,
            bracketMatching: true,
            closeBrackets: true,
          }}
          onChange={(value) => {
            setDraft(value);
            setDirty(true);
          }}
        />
      </div>
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.hint}>
        Cmd/Ctrl+S or click outside to commit. Your edit writes to{' '}
        <code>{activePage?.name}.module.css</code>; the canvas reloads from the file.
      </div>
    </>
  );
};
