import { useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { useCanvasStore } from '@store/canvasSlice';
import type { SampleRow, ScampElement } from '@lib/element';
import { classNameFor } from '@lib/generateCode/internal';
import { TAG_ATTRIBUTES } from '@lib/elementTags';
import { tagFor } from '@lib/generateCode/internal';
import {
  BOOLEAN_ATTRIBUTES,
  bindPropName,
  collectViewProps,
  enclosingRepeat,
  isInvertedBinding,
  isRowPath,
} from '@lib/viewProps';

import { SegmentedControl } from './controls/SegmentedControl';
import styles from './DataPanel.module.css';

/**
 * The Data tab's binding sections — Attributes, Events, Repeat, Show —
 * for the component or view being edited. Text props and slots stay in
 * DataPanel. Every edit goes through the bindings store slice.
 * see docs/notes/view-bindings.md
 */

const PROP_NAME_RE = /^[a-z][a-zA-Z0-9]*$/;
const FIELD_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const EVENT_BY_TAG: Record<string, ReadonlyArray<string>> = {
  button: ['onClick'],
  a: ['onClick'],
  input: ['onChange'],
  textarea: ['onChange'],
  select: ['onChange'],
  form: ['onSubmit'],
};

/** Attributes a binding may attach to: the typed ones for the tag, plus any present. */
const attributeCandidates = (el: ScampElement): string[] => {
  if (el.type === 'component-instance') {
    return [...new Set([...Object.keys(el.propOverrides ?? {}), ...Object.keys(el.bind ?? {})])];
  }
  const tag = tagFor(el);
  const typed = (TAG_ATTRIBUTES[tag] ?? []).map((spec) => spec.name);
  const link = tag === 'a' ? ['href', 'target'] : [];
  const present = Object.keys(el.attributes ?? {});
  const bound = Object.keys(el.bind ?? {});
  return [...new Set([...typed, ...link, ...present, ...bound])].filter((n) => n !== 'key');
};

const isBooleanAttribute = (el: ScampElement, attr: string): boolean => {
  if (el.type === 'component-instance') return false;
  if (BOOLEAN_ATTRIBUTES.has(attr)) return true;
  return (TAG_ATTRIBUTES[tagFor(el)] ?? []).some((s) => s.name === attr && s.kind === 'boolean');
};

const eventCandidates = (el: ScampElement): string[] => {
  if (el.type === 'component-instance') return Object.keys(el.on ?? {});
  return [...new Set([...(EVENT_BY_TAG[tagFor(el)] ?? []), ...Object.keys(el.on ?? {})])];
};

const elementLabel = (el: ScampElement): string =>
  el.type === 'component-instance' ? `${el.componentName ?? 'Instance'} ${el.instanceId ?? ''}`.trim() : classNameFor(el);

/**
 * A prop name, or a row path (`item.label`) when the element sits inside
 * a repeat. Returns the validation message, or null when acceptable.
 */
const validateBindingName = (
  name: string,
  elements: Record<string, ScampElement>,
  elementId: string,
  taken: ReadonlyArray<string>
): string | null => {
  if (name.length === 0) return 'Name the prop.';
  const repeat = enclosingRepeat(elements, elementId);
  if (isRowPath(name)) {
    const [head, ...rest] = name.split('.');
    if (repeat === null) return 'A row field needs a repeat above this element.';
    if (head !== repeat.as) return `Row fields start with ${repeat.as}.`;
    if (rest.length !== 1 || !FIELD_NAME_RE.test(rest[0] ?? '')) return 'Use one field: item.field';
    return null;
  }
  if (!PROP_NAME_RE.test(name)) return 'Use lowerCamelCase letters / digits only.';
  if (taken.includes(name)) return 'Already used by another prop.';
  return null;
};

/** A draft text input that commits on blur / Enter and reverts on Escape. */
const NameInput = ({
  value,
  onCommit,
  validate,
  ariaLabel,
  placeholder,
}: {
  value: string;
  onCommit: (next: string) => void;
  validate: (next: string) => string | null;
  ariaLabel: string;
  placeholder?: string;
}): JSX.Element => {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setDraft(value);
    setError(null);
  }, [value]);
  const commit = (): void => {
    const next = draft.trim();
    if (next === value) {
      setError(null);
      return;
    }
    const problem = validate(next);
    setError(problem);
    if (problem === null) onCommit(next);
  };
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') e.currentTarget.blur();
    if (e.key === 'Escape') {
      setDraft(value);
      setError(null);
      e.currentTarget.blur();
    }
  };
  return (
    <div className={styles.renameWrap}>
      <input
        className={styles.renameInput}
        type="text"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        aria-label={ariaLabel}
      />
      {error && <div className={styles.renameError}>{error}</div>}
    </div>
  );
};

const LOCKED_PROP = [
  { value: 'locked' as const, label: 'Locked' },
  { value: 'prop' as const, label: 'Prop' },
];
const NONE_PROP = [
  { value: 'none' as const, label: 'None' },
  { value: 'prop' as const, label: 'Prop' },
];

/** A name no prop uses yet: `base`, then `base2`, `base3`, … */
export const freePropName = (base: string, taken: ReadonlyArray<string>): string => {
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}${n}`)) n += 1;
  return `${base}${n}`;
};

export const BindingSections = (): JSX.Element | null => {
  const elements = useCanvasStore((s) => s.elements);
  const rootId = useCanvasStore((s) => s.rootElementId);
  const setAttributeBinding = useCanvasStore((s) => s.setAttributeBinding);
  const setEventBinding = useCanvasStore((s) => s.setEventBinding);
  const setRepeat = useCanvasStore((s) => s.setRepeat);
  const setShowIf = useCanvasStore((s) => s.setShowIf);
  const setSampleFlag = useCanvasStore((s) => s.setSampleFlag);
  const setSampleRows = useCanvasStore((s) => s.setSampleRows);
  const renameBindingProp = useCanvasStore((s) => s.renameBindingProp);
  const selectElement = useCanvasStore((s) => s.selectElement);

  const propNames = useMemo(
    () => collectViewProps(elements, rootId).map((p) => p.name),
    [elements, rootId]
  );
  const ordered = useMemo(() => {
    const out: ScampElement[] = [];
    const walk = (id: string): void => {
      const el = elements[id];
      if (!el) return;
      if (id !== rootId) out.push(el);
      for (const childId of el.childIds) walk(childId);
    };
    walk(rootId);
    return out;
  }, [elements, rootId]);
  const samples = elements[rootId]?.samples ?? {};

  const attributeRows = ordered.flatMap((el) =>
    attributeCandidates(el).map((attr) => ({ el, attr, expr: el.bind?.[attr] }))
  );
  const eventRows = ordered.flatMap((el) =>
    eventCandidates(el).map((event) => ({ el, event, handler: el.on?.[event] }))
  );
  const repeatRows = ordered.filter((el) => el.repeat !== undefined);
  const showRows = ordered.filter((el) => el.showIf !== undefined);

  if (attributeRows.length === 0 && eventRows.length === 0 && repeatRows.length === 0 && showRows.length === 0) {
    return null;
  }

  const otherNames = (own: string | undefined): string[] =>
    propNames.filter((n) => n !== own);

  return (
    <>
      {repeatRows.length > 0 && (
        <>
          <div className={styles.sectionTitle}>Repeat</div>
          <div className={styles.rows}>
            {repeatRows.map((el) => {
              const repeat = el.repeat;
              if (!repeat) return null;
              const rows = samples[repeat.over];
              const rowList: SampleRow[] = Array.isArray(rows) ? rows : [];
              const fields = [...new Set(rowList.flatMap((r) => Object.keys(r)))];
              const key = repeat.key ?? 'id';
              const setRows = (next: SampleRow[]): void => setSampleRows(repeat.over, next);
              return (
                <div key={el.id} className={styles.repeatBlock} data-testid={`repeat-${classNameFor(el)}`}>
                  <div className={styles.repeatHeader}>
                    <button type="button" className={styles.slotBadge} onClick={() => selectElement(el.id)} title="Select this element on the canvas">
                      ↻ {elementLabel(el)}
                    </button>
                    <label className={styles.repeatField}>
                      list
                      <input
                        className={styles.repeatInput}
                        aria-label="List prop"
                        defaultValue={repeat.over}
                        key={`over-${repeat.over}`}
                        spellCheck={false}
                        onBlur={(e) => {
                          const next = e.target.value.trim();
                          if (next === repeat.over) return;
                          if (validateBindingName(next, elements, rootId, otherNames(repeat.over)) !== null) {
                            e.target.value = repeat.over;
                            return;
                          }
                          renameBindingProp(repeat.over, next);
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                      />
                    </label>
                    <label className={styles.repeatField}>
                      as
                      <input
                        className={styles.repeatInput}
                        aria-label="Row variable"
                        defaultValue={repeat.as}
                        key={`as-${repeat.as}`}
                        spellCheck={false}
                        onBlur={(e) => {
                          const next = e.target.value.trim();
                          if (next === repeat.as || !PROP_NAME_RE.test(next)) {
                            e.target.value = repeat.as;
                            return;
                          }
                          setRepeat(el.id, { ...repeat, as: next });
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                      />
                    </label>
                    <label className={styles.repeatField}>
                      key
                      <select
                        className={styles.repeatInput}
                        aria-label="Row key"
                        value={key}
                        onChange={(e) => setRepeat(el.id, { ...repeat, key: e.target.value })}
                      >
                        {[...new Set(['id', ...fields])].map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </label>
                    <button type="button" className={styles.smallButton} onClick={() => setRepeat(el.id, null)}>
                      Stop repeating
                    </button>
                  </div>
                  <table className={styles.rowsTable}>
                    <thead>
                      <tr>
                        {fields.map((f) => <th key={f}>{f}</th>)}
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {rowList.map((row, i) => (
                        <tr key={i}>
                          {fields.map((f) => (
                            <td key={f}>
                              <input
                                className={styles.cellInput}
                                aria-label={`${repeat.over} row ${i + 1} ${f}`}
                                defaultValue={String(row[f] ?? '')}
                                key={`${i}-${f}-${String(row[f] ?? '')}`}
                                onBlur={(e) => {
                                  const raw = e.target.value;
                                  const value: string | number = /^-?\d+(?:\.\d+)?$/.test(raw) ? Number(raw) : raw;
                                  if (row[f] === value) return;
                                  setRows(rowList.map((r, j) => (j === i ? { ...r, [f]: value } : r)));
                                }}
                                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                              />
                            </td>
                          ))}
                          <td>
                            <button
                              type="button"
                              className={styles.smallButton}
                              aria-label={`Remove ${repeat.over} row ${i + 1}`}
                              onClick={() => setRows(rowList.filter((_, j) => j !== i))}
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className={styles.repeatHeader}>
                    <button
                      type="button"
                      className={styles.smallButton}
                      onClick={() => {
                        const blank: SampleRow = {};
                        for (const f of fields) blank[f] = f === key ? String(rowList.length + 1) : '';
                        if (!(key in blank)) blank[key] = String(rowList.length + 1);
                        setRows([...rowList, blank]);
                      }}
                    >
                      + Row
                    </button>
                    <NameInput
                      value=""
                      placeholder="+ field"
                      ariaLabel={`Add a field to ${repeat.over}`}
                      validate={(f) => (FIELD_NAME_RE.test(f) ? (fields.includes(f) ? 'Already a field.' : null) : 'Use a plain field name.')}
                      onCommit={(f) => {
                        const base = rowList.length > 0 ? rowList : [{ [key]: '1' }];
                        setRows(base.map((r) => ({ ...r, [f]: '' })));
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {showRows.length > 0 && (
        <>
          <div className={styles.sectionTitle}>Show</div>
          <div className={styles.rows}>
            {showRows.map((el) => {
              const flag = el.showIf ?? '';
              const name = bindPropName(flag);
              const sample = samples[name];
              return (
                <div key={el.id} className={styles.row} data-testid={`show-${classNameFor(el)}`}>
                  <button type="button" className={styles.slotBadge} onClick={() => selectElement(el.id)} title="Select this element on the canvas">
                    👁 {elementLabel(el)}
                  </button>
                  <NameInput
                    value={flag}
                    ariaLabel="Show when prop"
                    validate={(n) => validateBindingName(bindPropName(n), elements, el.id, otherNames(name))}
                    onCommit={(n) => {
                      if (isRowPath(bindPropName(n))) setShowIf(el.id, n);
                      else renameBindingProp(name, bindPropName(n));
                    }}
                  />
                  {!isRowPath(name) && (
                    <label className={styles.invertLabel}>
                      <input
                        type="checkbox"
                        aria-label={`${name} sample`}
                        checked={typeof sample === 'boolean' ? sample : true}
                        onChange={(e) => setSampleFlag(name, e.target.checked)}
                      />
                      on
                    </label>
                  )}
                  <button type="button" className={styles.smallButton} onClick={() => setShowIf(el.id, null)}>
                    Always show
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {attributeRows.length > 0 && (
        <>
          <div className={styles.sectionTitle}>Attributes</div>
          <div className={styles.rows}>
            {attributeRows.map(({ el, attr, expr }) => {
              const bound = expr !== undefined;
              const name = expr !== undefined ? bindPropName(expr) : '';
              const boolean = isBooleanAttribute(el, attr);
              return (
                <div key={`${el.id}:${attr}`} className={styles.row} data-testid={`attr-${classNameFor(el)}-${attr}`}>
                  <div className={styles.bindingLabel}>
                    <span className={styles.bindingElement}>{elementLabel(el)}</span>
                    <code className={styles.bindingName}>{attr}</code>
                  </div>
                  <SegmentedControl
                    value={bound ? 'prop' : 'locked'}
                    options={LOCKED_PROP}
                    onChange={(next) => {
                      if ((next === 'prop') === bound) return;
                      setAttributeBinding(
                        el.id,
                        attr,
                        next === 'prop' ? freePropName(attr === 'href' ? 'url' : attr, propNames) : null
                      );
                    }}
                  />
                  {bound && (
                    <>
                      <NameInput
                        value={name}
                        ariaLabel={`${attr} prop name`}
                        validate={(n) => validateBindingName(n, elements, el.id, otherNames(name))}
                        onCommit={(n) => setAttributeBinding(el.id, attr, n, isInvertedBinding(expr ?? ''))}
                      />
                      {boolean && (
                        <label className={styles.invertLabel}>
                          <input
                            type="checkbox"
                            aria-label={`Invert ${attr}`}
                            checked={isInvertedBinding(expr ?? '')}
                            onChange={(e) => setAttributeBinding(el.id, attr, name, e.target.checked)}
                          />
                          inverted
                        </label>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {eventRows.length > 0 && (
        <>
          <div className={styles.sectionTitle}>Events</div>
          <div className={styles.rows}>
            {eventRows.map(({ el, event, handler }) => (
              <div key={`${el.id}:${event}`} className={styles.row} data-testid={`event-${classNameFor(el)}-${event}`}>
                <div className={styles.bindingLabel}>
                  <span className={styles.bindingElement}>{elementLabel(el)}</span>
                  <code className={styles.bindingName}>{event}</code>
                </div>
                <SegmentedControl
                  value={handler !== undefined ? 'prop' : 'none'}
                  options={NONE_PROP}
                  onChange={(next) => {
                    if ((next === 'prop') === (handler !== undefined)) return;
                    setEventBinding(el.id, event, next === 'prop' ? freePropName(event, propNames) : null);
                  }}
                />
                {handler !== undefined && (
                  <NameInput
                    value={handler}
                    ariaLabel={`${event} handler name`}
                    validate={(n) => (PROP_NAME_RE.test(n) ? (otherNames(handler).includes(n) ? 'Already used by another prop.' : null) : 'Use lowerCamelCase letters / digits only.')}
                    onCommit={(n) => setEventBinding(el.id, event, n)}
                  />
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
};
