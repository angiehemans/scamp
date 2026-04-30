import { useEffect } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { DESKTOP_BREAKPOINT_ID } from '@shared/types';
import { ELEMENT_STATES, type ElementStateName } from '@lib/element';
import { Tooltip } from './controls/Tooltip';
import styles from './StateSwitcher.module.css';

const STATE_LABELS: Record<ElementStateName, string> = {
  hover: 'Hover',
  active: 'Active',
  focus: 'Focus',
};

const STATE_TOOLTIPS: Record<ElementStateName, string> = {
  hover: 'Edit styles for the :hover pseudo-class',
  active: 'Edit styles for the :active pseudo-class',
  focus: 'Edit styles for the :focus pseudo-class',
};

/**
 * Sits at the top of the properties panel and lets the user switch
 * between editing the element's default ("rest") styles and any of
 * the three recognised pseudo-class states. Edits made while a state
 * is active land in `element.stateOverrides[state]`; switching back
 * to Default returns the panel to top-level fields.
 *
 * State × non-desktop breakpoint isn't supported in this version, so
 * the non-default buttons are disabled (with a tooltip) when the
 * active breakpoint is anything but desktop.
 *
 * The dot indicator on a non-default button signals that the
 * currently-selected element has at least one override registered for
 * that state — so the user can tell at a glance which states already
 * have styles defined without clicking through them.
 */
export const StateSwitcher = (): JSX.Element => {
  const activeStateName = useCanvasStore((s) => s.activeStateName);
  const activeBreakpointId = useCanvasStore((s) => s.activeBreakpointId);
  const setActiveState = useCanvasStore((s) => s.setActiveState);
  const selectedId = useCanvasStore((s) => s.selectedElementIds[0] ?? null);
  const overriddenStates = useCanvasStore((s) => {
    if (!selectedId) return EMPTY_SET;
    const el = s.elements[selectedId];
    const overrides = el?.stateOverrides;
    if (!overrides) return EMPTY_SET;
    const result = new Set<ElementStateName>();
    for (const state of ELEMENT_STATES) {
      const o = overrides[state];
      if (o && Object.keys(o).length > 0) result.add(state);
    }
    return result;
  });

  const nonDesktop = activeBreakpointId !== DESKTOP_BREAKPOINT_ID;
  // When the user moves to a non-desktop breakpoint while a state was
  // active, fall back to default — the routing function would drop
  // patches in that combination, and showing the active state UI when
  // it's silently disabled is worse than auto-resetting.
  useEffect(() => {
    if (nonDesktop && activeStateName !== null) {
      setActiveState(null);
    }
  }, [nonDesktop, activeStateName, setActiveState]);

  return (
    <div className={styles.switcher} role="radiogroup" aria-label="Element state">
      <button
        type="button"
        role="radio"
        aria-checked={activeStateName === null}
        className={`${styles.button} ${activeStateName === null ? styles.buttonActive : ''}`}
        onClick={() => setActiveState(null)}
      >
        Default
      </button>
      {ELEMENT_STATES.map((state) => {
        const active = activeStateName === state;
        const hasOverride = overriddenStates.has(state);
        const button = (
          <button
            type="button"
            role="radio"
            aria-checked={active}
            disabled={nonDesktop}
            className={`${styles.button} ${active ? styles.buttonActive : ''} ${nonDesktop ? styles.buttonDisabled : ''}`}
            onClick={() => setActiveState(state)}
          >
            <span className={styles.label}>{STATE_LABELS[state]}</span>
            {hasOverride && (
              <span className={styles.dot} aria-label="has overrides" />
            )}
          </button>
        );
        const tip = nonDesktop
          ? 'State styles are only editable at the desktop breakpoint in this version'
          : STATE_TOOLTIPS[state];
        return (
          <Tooltip key={state} label={tip}>
            {button}
          </Tooltip>
        );
      })}
    </div>
  );
};

const EMPTY_SET: ReadonlySet<ElementStateName> = new Set();
