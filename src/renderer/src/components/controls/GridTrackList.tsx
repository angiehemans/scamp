import { useState } from 'react';
import {
  IconChevronDown,
  IconChevronRight,
  IconPlus,
  IconX,
} from '@tabler/icons-react';

import {
  parseGridTemplate,
  serializeGridTemplate,
  type GridTrack,
} from '@lib/gridTemplate';

import { EnumSelect } from './EnumSelect';
import { NumberInput } from './NumberInput';
import { PrefixSuffixInput } from './PrefixSuffixInput';
import styles from './GridTemplateEditor.module.css';

type TrackType = GridTrack['kind'];

type Props = {
  /** "Columns" or "Rows" — heading + singular used in labels. */
  label: string;
  /** The raw `grid-template-columns` / `-rows` string. */
  template: string;
  /** Called with the next raw template string on any edit. */
  onChange: (next: string) => void;
};

const TYPE_OPTIONS: ReadonlyArray<{ value: TrackType; label: string }> = [
  { value: 'fr', label: 'Fr' },
  { value: 'px', label: 'Px' },
  { value: 'percent', label: '%' },
  { value: 'auto', label: 'Auto' },
  { value: 'min-content', label: 'Min' },
  { value: 'max-content', label: 'Max' },
  { value: 'raw', label: 'Custom' },
];

const defaultTrack = (type: TrackType): GridTrack => {
  switch (type) {
    case 'fr':
      return { kind: 'fr', value: 1 };
    case 'px':
      return { kind: 'px', value: 100 };
    case 'percent':
      return { kind: 'percent', value: 25 };
    case 'auto':
      return { kind: 'auto' };
    case 'min-content':
      return { kind: 'min-content' };
    case 'max-content':
      return { kind: 'max-content' };
    case 'raw':
      return { kind: 'raw', source: 'minmax(100px, 1fr)' };
  }
};

const renderValue = (
  track: GridTrack,
  update: (next: GridTrack) => void
): JSX.Element | null => {
  if (track.kind === 'fr' || track.kind === 'px' || track.kind === 'percent') {
    const suffix = track.kind === 'fr' ? 'fr' : track.kind === 'px' ? 'px' : '%';
    return (
      <NumberInput
        value={track.value}
        onChange={(v) => {
          if (v !== undefined) update({ ...track, value: v });
        }}
        min={0}
        suffix={suffix}
        title="Track size"
      />
    );
  }
  if (track.kind === 'raw') {
    return (
      <PrefixSuffixInput
        value={track.source}
        onCommit={(v) => update({ kind: 'raw', source: v.trim() })}
        title="Custom track value"
      />
    );
  }
  // auto / min-content / max-content have no numeric value.
  return null;
};

/**
 * Collapsible per-track editor for one grid axis: a chip per track
 * (type + size), add/remove, and a proportional preview — tucked into
 * an accordion so a many-track grid stays compact. Falls back to a
 * plain text field when the template is too complex to model as a flat
 * track list (`parseGridTemplate` → null).
 */
export const GridTrackList = ({
  label,
  template,
  onChange,
}: Props): JSX.Element => {
  const [open, setOpen] = useState(false);
  const tracks = parseGridTemplate(template);
  const singular = label.toLowerCase().replace(/s$/, '');
  const countLabel = tracks === null ? 'custom' : String(tracks.length);

  const renderTracks = (list: GridTrack[]): JSX.Element => {
    const commit = (next: GridTrack[]): void =>
      onChange(serializeGridTemplate(next));
    const updateAt = (i: number, track: GridTrack): void =>
      commit(list.map((t, idx) => (idx === i ? track : t)));
    const removeAt = (i: number): void =>
      commit(list.filter((_, idx) => idx !== i));
    const add = (): void => commit([...list, { kind: 'fr', value: 1 }]);
    const serialized = serializeGridTemplate(list);

    return (
      <>
        {list.map((track, i) => (
          // eslint-disable-next-line react/no-array-index-key -- tracks are positional
          <div className={styles.track} key={i}>
            <span className={styles.trackIndex}>{i + 1}</span>
            <div className={styles.trackType}>
              <EnumSelect<TrackType>
                value={track.kind}
                options={TYPE_OPTIONS}
                onChange={(type) => updateAt(i, defaultTrack(type))}
                title="Track type"
              />
            </div>
            <div className={styles.trackValue}>
              {renderValue(track, (next) => updateAt(i, next))}
            </div>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={`Remove ${singular} ${i + 1}`}
              onClick={() => removeAt(i)}
            >
              <IconX size={14} />
            </button>
          </div>
        ))}
        <button type="button" className={styles.addButton} onClick={add}>
          <IconPlus size={13} /> Add {singular}
        </button>
        {list.length > 0 && (
          <div
            className={styles.preview}
            style={{ gridTemplateColumns: serialized }}
            aria-hidden
          >
            {list.map((_, i) => (
              // eslint-disable-next-line react/no-array-index-key -- positional preview cells
              <span key={i} className={styles.previewCell} />
            ))}
          </div>
        )}
      </>
    );
  };

  return (
    <div className={styles.trackList}>
      <button
        type="button"
        className={styles.accordionHeader}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? (
          <IconChevronDown size={13} />
        ) : (
          <IconChevronRight size={13} />
        )}
        <span className={styles.trackHeader}>{label}</span>
        <span className={styles.accordionCount}>{countLabel}</span>
      </button>
      {open &&
        (tracks === null ? (
          <div className={styles.fallback}>
            <PrefixSuffixInput
              value={template}
              onCommit={(v) => onChange(v.trim())}
              title={`${label} template`}
            />
            <span className={styles.fallbackNote}>
              Complex template — editing as text.
            </span>
          </div>
        ) : (
          renderTracks(tracks)
        ))}
    </div>
  );
};
