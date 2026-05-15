import { useState } from 'react';

import { useCanvasStore } from '@store/canvasSlice';
import { useGroupToggle, useResolvedElement } from '@store/useResolvedElement';
import type { FilterDef, FilterKind } from '@lib/element';
import {
  FILTER_DEFAULTS,
  FILTER_KINDS,
  FILTER_LABELS,
  FILTER_RANGES,
  FILTER_UNITS,
} from '@lib/filterKinds';

import { EnumSelect } from '../controls/EnumSelect';
import { NumberInput } from '../controls/NumberInput';
import { Tooltip } from '../controls/Tooltip';
import { Section, Row } from './Section';
import sectionStyles from './Section.module.css';
import styles from './FiltersSection.module.css';

type Props = {
  elementId: string;
};

const KIND_OPTIONS: ReadonlyArray<{ value: FilterKind; label: string }> =
  FILTER_KINDS.map((kind) => ({ value: kind, label: FILTER_LABELS[kind] }));

const makeFilter = (kind: FilterKind): FilterDef => ({
  kind,
  value: FILTER_DEFAULTS[kind],
});

/**
 * Per-row tooltip explaining what the filter does. Kept short so the
 * native title attribute renders cleanly across platforms.
 */
const KIND_TOOLTIPS: Record<FilterKind, string> = {
  blur: 'Gaussian blur applied to the element',
  brightness: 'Linear brightness multiplier (100% = unchanged)',
  contrast: 'Contrast multiplier (100% = unchanged)',
  grayscale: 'Desaturate towards grey (100% = fully grey)',
  'hue-rotate': 'Rotate hues around the color wheel',
  invert: 'Invert colors (100% = fully inverted)',
  opacity:
    'CSS filter opacity. Distinct from the element opacity property — applied as part of the filter chain.',
  saturate: 'Saturation multiplier (100% = unchanged)',
  sepia: 'Sepia tone (100% = fully sepia)',
};

export const FiltersSection = ({ elementId }: Props): JSX.Element | null => {
  const element = useResolvedElement(elementId);
  const patchElement = useCanvasStore((s) => s.patchElement);
  const groupToggle = useGroupToggle(elementId, 'filters');
  if (!element) return null;

  const filters: ReadonlyArray<FilterDef> = element.filters;
  const backdropFilters: ReadonlyArray<FilterDef> = element.backdropFilters;
  // Hide the eye when no filters are defined (or already off).
  const effectiveGroupToggle =
    filters.length > 0 || backdropFilters.length > 0 || !groupToggle.isOn
      ? groupToggle
      : undefined;

  // The backdrop subsection is gated behind a session-local toggle so
  // the common case stays compact. Once the user adds a row the
  // toggle implicitly flips on; we also reflect any pre-existing
  // backdrop list via the initial state.
  const [backdropOpen, setBackdropOpen] = useState<boolean>(
    backdropFilters.length > 0
  );

  const setFilters = (next: ReadonlyArray<FilterDef>): void => {
    patchElement(elementId, { filters: next });
  };
  const setBackdrop = (next: ReadonlyArray<FilterDef>): void => {
    patchElement(elementId, { backdropFilters: next });
  };

  const updateRow = (
    list: ReadonlyArray<FilterDef>,
    setter: (next: ReadonlyArray<FilterDef>) => void
  ) =>
    (idx: number, patch: Partial<FilterDef>): void => {
      setter(list.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
    };

  const removeRow = (
    list: ReadonlyArray<FilterDef>,
    setter: (next: ReadonlyArray<FilterDef>) => void
  ) =>
    (idx: number): void => {
      setter(list.filter((_, i) => i !== idx));
    };

  const addRowTo = (
    list: ReadonlyArray<FilterDef>,
    setter: (next: ReadonlyArray<FilterDef>) => void
  ) =>
    (): void => {
      setter([...list, makeFilter('blur')]);
    };

  const handleBackdropToggle = (next: boolean): void => {
    setBackdropOpen(next);
    if (!next && backdropFilters.length > 0) {
      setBackdrop([]);
    }
  };

  return (
    <Section
      title="Filters"
      collapsible
      defaultOpen={filters.length > 0 || backdropFilters.length > 0}
      elementId={elementId}
      groupToggle={effectiveGroupToggle}
      fields={['filters', 'backdropFilters']}
      cssProperties={['filter', 'backdrop-filter']}
    >
      {filters.length === 0 && (
        <div className={sectionStyles.row}>
          <span className={sectionStyles.rowLabel} data-testid="filters-empty">
            None
          </span>
        </div>
      )}
      {filters.map((filter, idx) => (
        <FilterRow
          key={idx}
          index={idx}
          filter={filter}
          onChange={(patch) => updateRow(filters, setFilters)(idx, patch)}
          onRemove={() => removeRow(filters, setFilters)(idx)}
        />
      ))}
      <Row label="">
        <button
          type="button"
          className={sectionStyles.rowAddButton}
          onClick={addRowTo(filters, setFilters)}
        >
          + Add filter
        </button>
      </Row>

      <div className={styles.backdropDivider} />

      <div className={styles.backdropHeader}>
        <span className={styles.backdropTitle}>Backdrop filter</span>
        <Tooltip label="Backdrop filter applies effects to content behind this element. Requires a partially transparent background to be visible.">
          <label className={styles.backdropToggle}>
            <input
              type="checkbox"
              checked={backdropOpen}
              onChange={(e) => handleBackdropToggle(e.target.checked)}
            />
            <span>Enable</span>
          </label>
        </Tooltip>
      </div>

      {backdropOpen && (
        <>
          {backdropFilters.length === 0 && (
            <div className={sectionStyles.row}>
              <span className={styles.backdropHint}>
                Requires partially transparent background to be visible.
              </span>
            </div>
          )}
          {backdropFilters.map((filter, idx) => (
            <FilterRow
              key={idx}
              index={idx}
              filter={filter}
              onChange={(patch) =>
                updateRow(backdropFilters, setBackdrop)(idx, patch)
              }
              onRemove={() => removeRow(backdropFilters, setBackdrop)(idx)}
            />
          ))}
          <Row label="">
            <button
              type="button"
              className={sectionStyles.rowAddButton}
              onClick={addRowTo(backdropFilters, setBackdrop)}
            >
              + Add backdrop filter
            </button>
          </Row>
        </>
      )}
    </Section>
  );
};

type RowProps = {
  index: number;
  filter: FilterDef;
  onChange: (patch: Partial<FilterDef>) => void;
  onRemove: () => void;
};

const FilterRow = ({
  index,
  filter,
  onChange,
  onRemove,
}: RowProps): JSX.Element => {
  const unit = FILTER_UNITS[filter.kind];
  const range = FILTER_RANGES[filter.kind];

  const handleKindChange = (next: FilterKind): void => {
    // Reset the value to the new kind's canonical default rather than
    // re-interpreting the old number under the new unit — switching
    // from blur(50px) to brightness should not produce brightness(50%).
    onChange({ kind: next, value: FILTER_DEFAULTS[next] });
  };

  return (
    <div className={styles.filterRow}>
      <div className={styles.rowHeader}>
        <span className={styles.rowTitle}>Filter {index + 1}</span>
        <Tooltip label={`Remove filter ${index + 1}`}>
          <button
            type="button"
            className={sectionStyles.rowRemoveButton}
            onClick={onRemove}
            aria-label={`Remove filter ${index + 1}`}
          >
            ×
          </button>
        </Tooltip>
      </div>
      <Row label="">
        <EnumSelect<FilterKind>
          value={filter.kind}
          options={KIND_OPTIONS}
          onChange={handleKindChange}
          title={KIND_TOOLTIPS[filter.kind]}
        />
        <NumberInput
          suffix={unit}
          title={KIND_TOOLTIPS[filter.kind]}
          value={filter.value}
          onChange={(value) => value !== undefined && onChange({ value })}
          min={range.min}
          max={range.max}
        />
      </Row>
    </div>
  );
};
