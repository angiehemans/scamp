import type { ProjectConfig } from '@shared/types';
import { ColorInput } from './controls/ColorInput';
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
          <h2 className={styles.sectionTitle}>Fonts</h2>
          <FontsSection projectPath={projectPath} />
        </div>
      </div>
    </div>
  );
};
