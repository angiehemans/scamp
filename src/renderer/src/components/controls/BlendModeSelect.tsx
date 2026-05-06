import { BLEND_MODE_GROUPS } from '@lib/blendModes';
import type { BlendMode } from '@lib/element';
import { Tooltip } from './Tooltip';
import styles from './Controls.module.css';

type Props = {
  value: BlendMode;
  onChange: (next: BlendMode) => void;
  /** Tooltip shown on hover. */
  title?: string;
};

/**
 * Grouped CSS blend-mode dropdown. Used by both `VisibilitySection`
 * (`mix-blend-mode`) and `BackgroundSection` (`background-blend-mode`)
 * — the keyword set is identical across the two CSS properties, so a
 * single component covers both surfaces. The `<optgroup>` headers
 * mirror the categories from `BLEND_MODE_GROUPS` (Darken / Lighten /
 * Contrast / Inversion / Component) so the dropdown reads like the
 * spec.
 */
export const BlendModeSelect = ({
  value,
  onChange,
  title,
}: Props): JSX.Element => {
  const select = (
    <select
      className={styles.select}
      value={value}
      onChange={(e) => onChange(e.target.value as BlendMode)}
    >
      <option value="normal">Normal</option>
      {BLEND_MODE_GROUPS.map((group) => (
        <optgroup key={group.name} label={group.name}>
          {group.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
  return title ? <Tooltip label={title}>{select}</Tooltip> : select;
};
