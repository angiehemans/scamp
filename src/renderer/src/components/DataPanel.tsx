import { useMemo, useState, useRef, useEffect } from 'react';
import type { KeyboardEvent } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import type { ScampElement } from '@lib/element';
import { SegmentedControl } from './controls/SegmentedControl';
import styles from './DataPanel.module.css';
import propStyles from './PropertiesPanel.module.css';

// Data tab: component-only prop/locked toggle + per-instance overrides.
// see docs/notes/components-data-model.md
const PROP_NAME_RE = /^[a-z][a-zA-Z0-9]*$/;

/** Prop→Locked toggle dispatch; ProjectShell decides whether to warn. */
export const REQUEST_LOCK_PROP_EVENT = 'scamp:request-lock-prop';
export type RequestLockPropEventDetail = {
  elementId: string;
  componentName: string;
  propName: string;
};

type TextRow = {
  id: string;
  text: string;
  prop: string | undefined;
};

const collectTextDescendants = (
  elements: Record<string, ScampElement>,
  rootId: string
): TextRow[] => {
  const rows: TextRow[] = [];
  const walk = (id: string): void => {
    const el = elements[id];
    if (!el) return;
    if (el.type === 'text' && id !== rootId) {
      rows.push({ id, text: el.text ?? '', prop: el.prop });
    }
    for (const childId of el.childIds) walk(childId);
  };
  walk(rootId);
  return rows;
};

const TOGGLE_OPTIONS = [
  { value: 'locked' as const, label: 'Locked' },
  { value: 'prop' as const, label: 'Prop' },
];

const DataRow = ({
  row,
  otherPropNames,
}: {
  row: TextRow;
  otherPropNames: ReadonlyArray<string>;
}): JSX.Element => {
  const togglePropOnText = useCanvasStore((s) => s.togglePropOnText);
  const renamePropOnText = useCanvasStore((s) => s.renamePropOnText);
  const activeComponentName = useCanvasStore(
    (s) => s.activeComponent?.name ?? null
  );
  const [draftName, setDraftName] = useState(row.prop ?? '');
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Resync draft when prop changes externally (undo, reload).
  useEffect(() => {
    setDraftName(row.prop ?? '');
  }, [row.prop]);

  const isProp = row.prop !== undefined;
  const validationError = (() => {
    if (!isProp) return null;
    if (draftName === row.prop) return null;
    if (!PROP_NAME_RE.test(draftName)) {
      return 'Use lowerCamelCase letters / digits only.';
    }
    if (otherPropNames.includes(draftName)) {
      return 'Already used by another prop.';
    }
    return null;
  })();

  const commitRename = (): void => {
    if (!isProp) return;
    if (draftName === row.prop) return;
    if (validationError) return;
    renamePropOnText(row.id, draftName);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitRename();
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setDraftName(row.prop ?? '');
      inputRef.current?.blur();
    }
  };

  return (
    <div className={styles.row}>
      <div className={styles.preview} title={row.text || '(empty)'}>
        {row.text.length > 0 ? row.text : <em className={styles.emptyText}>(empty)</em>}
      </div>
      <SegmentedControl
        value={isProp ? 'prop' : 'locked'}
        options={TOGGLE_OPTIONS}
        onChange={(next) => {
          if ((next === 'prop') === isProp) return;
          if (next === 'prop') {
            togglePropOnText(row.id);
            return;
          }
          // Prop → Locked may warn cross-page; defer to ProjectShell.
          if (!activeComponentName || !row.prop) {
            togglePropOnText(row.id);
            return;
          }
          window.dispatchEvent(
            new CustomEvent<RequestLockPropEventDetail>(REQUEST_LOCK_PROP_EVENT, {
              detail: {
                elementId: row.id,
                componentName: activeComponentName,
                propName: row.prop,
              },
            })
          );
        }}
      />
      {isProp && (
        <div className={styles.renameWrap}>
          <input
            ref={inputRef}
            className={styles.renameInput}
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            aria-label="Prop name"
          />
          {validationError && (
            <div className={styles.renameError}>{validationError}</div>
          )}
        </div>
      )}
    </div>
  );
};

/** Component-editor: list text descendants with prop/locked toggle. */
const ComponentDataView = (): JSX.Element => {
  const elements = useCanvasStore((s) => s.elements);
  const rootElementId = useCanvasStore((s) => s.rootElementId);

  const rows = useMemo(
    () => collectTextDescendants(elements, rootElementId),
    [elements, rootElementId]
  );

  // For each row's rename validator: every OTHER row's prop name.
  // Precomputing once means the rows don't each rebuild the same
  // set on every keystroke.
  const allPropNames = useMemo(
    () => rows.flatMap((r) => (r.prop !== undefined ? [r.prop] : [])),
    [rows]
  );

  if (rows.length === 0) {
    return (
      <div className={propStyles.uiPanelBody}>
        <div className={styles.empty}>
          No text elements in this component yet. Add a text element on
          the canvas, then return to this tab to mark it as a prop.
        </div>
      </div>
    );
  }

  return (
    <div className={propStyles.uiPanelBody}>
      <div className={styles.intro}>
        Mark a text element as a prop to let pages override its content
        per-instance. Locked text stays the same on every instance.
      </div>
      <div className={styles.rows}>
        {rows.map((row) => (
          <DataRow
            key={row.id}
            row={row}
            otherPropNames={allPropNames.filter((n) => n !== row.prop)}
          />
        ))}
      </div>
    </div>
  );
};

type PropDeclaration = {
  name: string;
  defaultText: string;
};

const collectPropDeclarations = (
  elements: Record<string, ScampElement>,
  rootId: string
): PropDeclaration[] => {
  const out: PropDeclaration[] = [];
  const seen = new Set<string>();
  const walk = (id: string): void => {
    const el = elements[id];
    if (!el) return;
    if (
      el.type === 'text' &&
      typeof el.prop === 'string' &&
      el.prop.length > 0 &&
      !seen.has(el.prop)
    ) {
      seen.add(el.prop);
      out.push({ name: el.prop, defaultText: el.text ?? '' });
    }
    for (const childId of el.childIds) walk(childId);
  };
  walk(rootId);
  return out;
};

/**
 * One row of the instance-side Data tab: prop name label + a
 * textarea bound to the override (or the component default when
 * no override is set). A "Reset" button surfaces only when an
 * override exists, so the row visually distinguishes
 * "overridden" from "showing default".
 */
const InstanceRow = ({
  instanceId,
  declaration,
  overrideValue,
}: {
  instanceId: string;
  declaration: PropDeclaration;
  overrideValue: string | undefined;
}): JSX.Element => {
  const setPropOverride = useCanvasStore((s) => s.setPropOverride);
  const clearPropOverride = useCanvasStore((s) => s.clearPropOverride);
  // Draft committed on blur — avoids one history entry per keystroke.
  const initial = overrideValue ?? declaration.defaultText;
  const [draft, setDraft] = useState(initial);
  useEffect(() => {
    setDraft(overrideValue ?? declaration.defaultText);
  }, [overrideValue, declaration.defaultText]);

  const isOverridden = overrideValue !== undefined;
  const commit = (): void => {
    if (draft === initial) return;
    setPropOverride(instanceId, declaration.name, draft);
  };

  return (
    <div className={styles.row}>
      <div className={styles.propLabelRow}>
        <code className={styles.propName}>{declaration.name}</code>
        {isOverridden && (
          <button
            type="button"
            className={styles.resetButton}
            onClick={() => clearPropOverride(instanceId, declaration.name)}
            aria-label={`Reset ${declaration.name} to component default`}
          >
            Reset
          </button>
        )}
      </div>
      <textarea
        className={styles.overrideInput}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        rows={2}
        spellCheck={false}
        aria-label={`Override value for ${declaration.name}`}
      />
    </div>
  );
};

/** Page-side: one row per declared prop of the selected instance. */
const InstanceDataView = (): JSX.Element => {
  const instance = useCanvasStore((s) => {
    const selectedId = s.selectedElementIds[0];
    if (!selectedId) return null;
    const el = s.elements[selectedId];
    return el && el.type === 'component-instance' ? el : null;
  });
  const componentTree = useCanvasStore((s) => {
    const name = instance?.componentName;
    if (!name) return undefined;
    return s.componentTrees[name];
  });

  const declarations = useMemo(() => {
    if (!componentTree) return [] as PropDeclaration[];
    return collectPropDeclarations(componentTree.elements, componentTree.rootId);
  }, [componentTree]);

  if (!instance) {
    return (
      <div className={propStyles.uiPanelBody}>
        <div className={styles.empty}>Select a component on the canvas.</div>
      </div>
    );
  }
  if (declarations.length === 0) {
    return (
      <div className={propStyles.uiPanelBody}>
        <div className={styles.empty}>
          {instance.componentName ?? 'This component'} has no declared props.
          Open the component editor and toggle a text element to Prop to add
          one.
        </div>
      </div>
    );
  }

  const overrides = instance.propOverrides ?? {};
  return (
    <div className={propStyles.uiPanelBody}>
      <div className={styles.intro}>
        Override the text content of this {instance.componentName} instance.
        Empty an override and Reset to restore the component default.
      </div>
      <div className={styles.rows}>
        {declarations.map((decl) => (
          <InstanceRow
            key={decl.name}
            instanceId={instance.id}
            declaration={decl}
            overrideValue={
              Object.prototype.hasOwnProperty.call(overrides, decl.name)
                ? overrides[decl.name]
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
};

export const DataPanel = (): JSX.Element => {
  const isComponentEditing = useCanvasStore((s) => s.activeComponent !== null);
  return isComponentEditing ? <ComponentDataView /> : <InstanceDataView />;
};
