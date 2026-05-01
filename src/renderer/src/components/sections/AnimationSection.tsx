import { useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { useResolvedElement } from '@store/useResolvedElement';
import {
  ANIMATION_PRESETS,
  type AnimationPreset,
  type AnimationPresetCategory,
} from '@lib/animationPresets';
import type {
  AnimationDirection,
  AnimationFillMode,
  AnimationPlayState,
  ElementAnimation,
} from '@lib/element';
import { EnumSelect } from '../controls/EnumSelect';
import { NumberInput } from '../controls/NumberInput';
import { PrefixSuffixInput } from '../controls/PrefixSuffixInput';
import { SegmentedControl } from '../controls/SegmentedControl';
import { Tooltip } from '../controls/Tooltip';
import { DualField, Row, Section } from './Section';
import controlStyles from '../controls/Controls.module.css';
import sectionStyles from './Section.module.css';
import styles from './AnimationSection.module.css';

type Props = {
  elementId: string;
};

const NONE_VALUE = '__none__';

const CATEGORY_LABEL: Record<AnimationPresetCategory, string> = {
  entrance: 'Entrances',
  exit: 'Exits',
  attention: 'Attention',
  subtle: 'Subtle',
};

const DIRECTION_OPTIONS: ReadonlyArray<{ value: AnimationDirection; label: string }> = [
  { value: 'normal', label: 'Normal' },
  { value: 'reverse', label: 'Reverse' },
  { value: 'alternate', label: 'Alternate' },
  { value: 'alternate-reverse', label: 'Alt. reverse' },
];

const FILL_MODE_OPTIONS: ReadonlyArray<{ value: AnimationFillMode; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'forwards', label: 'Forwards' },
  { value: 'backwards', label: 'Backwards' },
  { value: 'both', label: 'Both' },
];

const PLAY_STATE_OPTIONS: ReadonlyArray<{ value: AnimationPlayState; label: string }> = [
  { value: 'running', label: '▶ Running' },
  { value: 'paused', label: '⏸ Paused' },
];

const NAMED_EASINGS = ['ease', 'linear', 'ease-in', 'ease-out', 'ease-in-out'] as const;

const presetsByCategory = (): Record<AnimationPresetCategory, AnimationPreset[]> => {
  const result: Record<AnimationPresetCategory, AnimationPreset[]> = {
    entrance: [],
    exit: [],
    attention: [],
    subtle: [],
  };
  for (const preset of ANIMATION_PRESETS) result[preset.category].push(preset);
  return result;
};

/**
 * Properties-panel section for the element's CSS animation. Reads
 * the resolved animation through `useResolvedElement` so the values
 * shown reflect the active state (base in Default mode; the state
 * override in Hover / Active / Focus). Edits route through
 * `setAnimation` / `removeAnimation`, which the canvas store routes
 * to the right axis.
 */
export const AnimationSection = ({ elementId }: Props): JSX.Element | null => {
  const element = useResolvedElement(elementId);
  const rawElement = useCanvasStore((s) => s.elements[elementId]);
  const activeStateName = useCanvasStore((s) => s.activeStateName);
  const setAnimation = useCanvasStore((s) => s.setAnimation);
  const removeAnimation = useCanvasStore((s) => s.removeAnimation);
  const playAnimation = useCanvasStore((s) => s.playAnimation);
  if (!element) return null;

  const animation = element.animation;
  // Multi-animation source ends up in customProperties.animation —
  // the picker can't model the multi case, so we surface a hint.
  const multiAnimationRaw = element.customProperties.animation;

  const handleSelectPreset = (value: string): void => {
    if (value === NONE_VALUE) {
      removeAnimation(elementId);
      return;
    }
    const preset = ANIMATION_PRESETS.find((p) => p.name === value);
    if (!preset) return;
    setAnimation(elementId, {
      name: preset.name,
      isPreset: true,
      ...preset.defaults,
      delayMs: 0,
      playState: 'running',
    });
  };

  const updateField = (patch: Partial<ElementAnimation>): void => {
    if (!animation) return;
    setAnimation(elementId, { ...animation, ...patch });
  };

  // No typed animation AND no raw animation declaration → empty state.
  if (!animation && !multiAnimationRaw) {
    return (
      <Section
        title="Animation"
        collapsible
        defaultOpen={false}
        elementId={elementId}
        fields={['animation']}
      >
        <Row
          label="Preset"
          tooltip="Pick an animation to play on this element. Choose None to remove."
        >
          <PresetSelect value={NONE_VALUE} onChange={handleSelectPreset} />
        </Row>
      </Section>
    );
  }

  // Multi-animation source → can't model, defer to CSS mode.
  if (!animation && multiAnimationRaw) {
    return (
      <Section
        title="Animation"
        collapsible
        defaultOpen={false}
        elementId={elementId}
        fields={['animation']}
      >
        <div className={styles.hint}>
          Multiple animations declared. Edit in CSS mode.
        </div>
      </Section>
    );
  }

  if (!animation) return null;

  const isLoop =
    animation.iterationCount === 'infinite' || animation.iterationCount > 1;
  const stateMode = activeStateName;
  const showHoverRestartHint =
    stateMode !== null && animation.iterationCount === 'infinite';

  const isCustom = !animation.isPreset;
  const stateHasOverride =
    stateMode !== null &&
    rawElement?.stateOverrides?.[stateMode]?.animation !== undefined;

  return (
    <Section
      title="Animation"
      collapsible
      defaultOpen
      elementId={elementId}
      fields={['animation']}
    >
      <Row
        label="Preset"
        tooltip="The named animation. Switching presets replaces all the properties below with that preset's defaults."
      >
        <PresetSelect
          value={animation.name}
          onChange={handleSelectPreset}
          isCustom={isCustom}
        />
      </Row>

      {stateMode !== null && !stateHasOverride && (
        <div className={styles.hint}>
          Same as default — edits will create a {stateMode}-state override.
        </div>
      )}

      <DualField
        left={{
          label: 'Duration',
          tooltip: 'How long one iteration of the animation takes.',
          children: (
            <NumberInput
              value={animation.durationMs}
              onChange={(ms) =>
                ms !== undefined && updateField({ durationMs: ms })
              }
              min={0}
              suffix="ms"
            />
          ),
        }}
        right={{
          label: 'Easing',
          tooltip:
            'The acceleration curve. ease starts and ends slowly; linear is constant; ease-in starts slow; ease-out ends slow; ease-in-out is slow at both ends.',
          children: (
            <EnumSelect
              value={
                (NAMED_EASINGS as ReadonlyArray<string>).includes(animation.easing)
                  ? animation.easing
                  : 'ease'
              }
              options={NAMED_EASINGS.map((e) => ({ value: e, label: e }))}
              onChange={(easing) => updateField({ easing })}
            />
          ),
        }}
      />

      <DualField
        left={{
          label: 'Delay',
          tooltip: 'Wait this long after the element is rendered before the animation starts.',
          children: (
            <NumberInput
              value={animation.delayMs}
              onChange={(ms) =>
                ms !== undefined && updateField({ delayMs: ms })
              }
              min={0}
              suffix="ms"
            />
          ),
        }}
        right={{
          label: 'Iteration',
          tooltip:
            'How many times the animation repeats. Use the dropdown to switch to an infinite loop.',
          children: (
            <IterationField
              value={animation.iterationCount}
              onChange={(next) => updateField({ iterationCount: next })}
            />
          ),
        }}
      />

      <DualField
        left={{
          label: 'Direction',
          tooltip:
            'Normal plays the animation forward each iteration.\n' +
            'Reverse plays it backward.\n' +
            'Alternate alternates forward / backward across iterations.\n' +
            'Alt. reverse is the same but starts backward.',
          children: (
            <EnumSelect
              value={animation.direction}
              options={DIRECTION_OPTIONS}
              onChange={(direction) => updateField({ direction })}
            />
          ),
        }}
        right={{
          label: 'Fill mode',
          tooltip:
            'Which styles apply outside the animation playback.\n' +
            'None: revert to the base styles before and after.\n' +
            'Forwards: keep the final keyframe styles after the animation ends.\n' +
            'Backwards: apply the first keyframe styles during the delay (before playback).\n' +
            'Both: forwards + backwards.',
          children: (
            <EnumSelect
              value={animation.fillMode}
              options={FILL_MODE_OPTIONS}
              onChange={(fillMode) => updateField({ fillMode })}
            />
          ),
        }}
      />

      <Row
        label="Play state"
        tooltip="Running plays the animation; Paused freezes it at its current frame. Useful for animations you want to start later via JavaScript."
      >
        <SegmentedControl
          value={animation.playState}
          options={PLAY_STATE_OPTIONS}
          onChange={(playState) => updateField({ playState })}
        />
      </Row>

      {showHoverRestartHint && isLoop && (
        <div className={styles.hint}>
          Infinite loops restart every time the user re-enters {stateMode}.
          For continuous loops, set the animation on the default state instead.
        </div>
      )}

      <div className={styles.actions}>
        <Tooltip label="Play the animation once on the canvas. Infinite loops only play one iteration in the editor.">
          <button
            type="button"
            className={sectionStyles.rowAddButton}
            onClick={() => playAnimation(elementId)}
          >
            ▶ Play preview
          </button>
        </Tooltip>
        <Tooltip label="Clear this animation from the element. The keyframes stay in the file in case you re-apply.">
          <button
            type="button"
            className={sectionStyles.rowAddButton}
            onClick={() => removeAnimation(elementId)}
          >
            ✕ Remove
          </button>
        </Tooltip>
      </div>
    </Section>
  );
};

type PresetSelectProps = {
  value: string;
  onChange: (value: string) => void;
  isCustom?: boolean;
};

const PresetSelect = ({
  value,
  onChange,
  isCustom = false,
}: PresetSelectProps): JSX.Element => {
  const grouped = presetsByCategory();
  return (
    <select
      className={controlStyles.select}
      value={isCustom ? '__custom__' : value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value={NONE_VALUE}>None</option>
      {isCustom && (
        <option value="__custom__" disabled>
          Custom: {value}
        </option>
      )}
      {(Object.keys(grouped) as AnimationPresetCategory[]).map((category) => (
        <optgroup key={category} label={CATEGORY_LABEL[category]}>
          {grouped[category].map((preset) => (
            <option key={preset.name} value={preset.name}>
              {preset.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
};

type IterationFieldProps = {
  value: number | 'infinite';
  onChange: (next: number | 'infinite') => void;
};

/**
 * Iteration count input that always *looks* like a field. Numeric
 * mode shows a regular NumberInput; infinite mode shows the literal
 * text "Infinite" in a disabled-looking input. A caret button at
 * the right opens a small popover menu with the two modes — exactly
 * one is checked at any time.
 *
 * The last numeric value the user typed is remembered so toggling
 * back to "Number" via the dropdown restores it instead of snapping
 * to 1.
 */
const IterationField = ({ value, onChange }: IterationFieldProps): JSX.Element => {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  // Remember the last numeric value across infinite toggles.
  const lastNumericRef = useRef<number>(1);
  if (value !== 'infinite') lastNumericRef.current = value;
  const isInfinite = value === 'infinite';

  // Outside-click + Escape close the menu.
  useEffect(() => {
    if (!menuOpen) return;
    const handleDocClick = (e: MouseEvent): void => {
      const node = wrapperRef.current;
      if (!node) return;
      if (!node.contains(e.target as Node)) setMenuOpen(false);
    };
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleDocClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDocClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  const caret = (
    <button
      type="button"
      className={styles.iterationCaret}
      onClick={() => setMenuOpen((v) => !v)}
      aria-label="Iteration mode"
      aria-haspopup="menu"
      aria-expanded={menuOpen}
    >
      ▾
    </button>
  );

  const handleNumberCommit = (n: number): void => {
    lastNumericRef.current = n;
    onChange(n);
  };

  return (
    <div className={styles.iterationWrapper} ref={wrapperRef}>
      {isInfinite ? (
        <PrefixSuffixInput
          value="Infinite"
          onCommit={() => undefined}
          disabled
          suffix={caret}
        />
      ) : (
        <NumberInput
          value={value}
          onChange={(n) => n !== undefined && handleNumberCommit(n)}
          min={1}
          suffix={caret}
        />
      )}
      {menuOpen && (
        <div className={styles.iterationMenu} role="menu">
          <button
            type="button"
            role="menuitemradio"
            aria-checked={!isInfinite}
            className={`${styles.iterationMenuItem} ${
              !isInfinite ? styles.iterationMenuItemActive : ''
            }`}
            onClick={() => {
              onChange(lastNumericRef.current);
              setMenuOpen(false);
            }}
          >
            <span className={styles.iterationMenuCheck}>
              {!isInfinite ? '✓' : ''}
            </span>
            Number
          </button>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={isInfinite}
            className={`${styles.iterationMenuItem} ${
              isInfinite ? styles.iterationMenuItemActive : ''
            }`}
            onClick={() => {
              onChange('infinite');
              setMenuOpen(false);
            }}
          >
            <span className={styles.iterationMenuCheck}>
              {isInfinite ? '✓' : ''}
            </span>
            Infinite
          </button>
        </div>
      )}
    </div>
  );
};
