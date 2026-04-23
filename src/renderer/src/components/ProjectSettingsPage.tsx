import { useState } from 'react';
import type { Breakpoint, ProjectConfig } from '@shared/types';
import { DESKTOP_BREAKPOINT_ID } from '@shared/types';
import { ColorInput } from './controls/ColorInput';
import { NumberInput } from './controls/NumberInput';
import { PrefixSuffixInput } from './controls/PrefixSuffixInput';
import { FontsSection } from './sections/FontsSection';
import styles from './ProjectSettingsPage.module.css';

type Props = {
  projectName: string;
  projectPath: string;
  config: ProjectConfig;
  onChange: (next: ProjectConfig) => void;
  onBack: () => void;
};

export const ProjectSettingsPage = ({
  projectName,
  projectPath,
  config,
  onChange,
  onBack,
}: Props): JSX.Element => {
  const handleArtboardChange = (value: string): void => {
    onChange({ ...config, artboardBackground: value });
  };

  const updateBreakpoints = (breakpoints: Breakpoint[]): void => {
    // Keep widest-first ordering so the generator emits in CSS cascade
    // order automatically.
    const sorted = [...breakpoints].sort((a, b) => b.width - a.width);
    onChange({ ...config, breakpoints: sorted });
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={onBack} type="button">
          ← Back
        </button>
        <h1 className={styles.headerTitle}>Project Settings</h1>
        <span className={styles.headerProject}>{projectName}</span>
      </div>

      <div className={styles.body}>
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>General</h2>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Artboard background</span>
            <div className={styles.rowControl}>
              <ColorInput
                value={config.artboardBackground}
                onChange={handleArtboardChange}
              />
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Breakpoints</h2>
          <BreakpointsEditor
            breakpoints={config.breakpoints}
            onChange={updateBreakpoints}
          />
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Fonts</h2>
          <FontsSection projectPath={projectPath} />
        </div>
      </div>
    </div>
  );
};

type BreakpointsEditorProps = {
  breakpoints: Breakpoint[];
  onChange: (next: Breakpoint[]) => void;
};

const BreakpointsEditor = ({
  breakpoints,
  onChange,
}: BreakpointsEditorProps): JSX.Element => {
  // Local id for newly-added breakpoints before the user types a real
  // one. Incremented so successive adds don't collide.
  const [nextId, setNextId] = useState(1);

  const updateAt = (idx: number, patch: Partial<Breakpoint>): void => {
    const next = breakpoints.map((bp, i) => (i === idx ? { ...bp, ...patch } : bp));
    onChange(next);
  };

  const removeAt = (idx: number): void => {
    const target = breakpoints[idx];
    if (!target) return;
    // Never remove desktop — it's the base breakpoint every other one
    // cascades from.
    if (target.id === DESKTOP_BREAKPOINT_ID) return;
    onChange(breakpoints.filter((_, i) => i !== idx));
  };

  const addBreakpoint = (): void => {
    const id = `custom-${nextId}`;
    setNextId(nextId + 1);
    onChange([
      ...breakpoints,
      { id, label: 'Custom', width: 600 },
    ]);
  };

  return (
    <div>
      <p className={styles.sectionHint}>
        Style edits made while a non-desktop breakpoint is active land inside
        the matching <code>@media (max-width: Npx)</code> block. Desktop is
        the base — no <code>@media</code> wrapper.
      </p>
      <div className={styles.bpTable}>
        {breakpoints.map((bp, idx) => {
          const isDesktop = bp.id === DESKTOP_BREAKPOINT_ID;
          return (
            <div key={bp.id} className={styles.bpRow}>
              <div className={styles.bpLabelCell}>
                <PrefixSuffixInput
                  value={bp.label}
                  placeholder="Label"
                  onCommit={(next) => updateAt(idx, { label: next })}
                />
              </div>
              <div className={styles.bpWidthCell}>
                <NumberInput
                  value={bp.width}
                  onChange={(next) => {
                    if (next !== undefined) updateAt(idx, { width: Math.round(next) });
                  }}
                  min={100}
                  max={4000}
                  suffix="px"
                />
              </div>
              <button
                type="button"
                className={styles.bpRemove}
                onClick={() => removeAt(idx)}
                disabled={isDesktop}
                title={
                  isDesktop
                    ? 'Desktop is the base breakpoint and cannot be removed'
                    : 'Remove breakpoint'
                }
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      <button type="button" className={styles.bpAdd} onClick={addBreakpoint}>
        + Add breakpoint
      </button>
    </div>
  );
};
