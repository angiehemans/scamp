import { useCallback, useEffect, useState } from 'react';
import type { Settings } from '@shared/types';
import { ColorInput } from './controls/ColorInput';
import styles from './SettingsPage.module.css';

type Props = {
  onBack: () => void;
};

export const SettingsPage = ({ onBack }: Props): JSX.Element => {
  const [settings, setSettings] = useState<Settings | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    const next = await window.scamp.getSettings();
    setSettings(next);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handlePickFolder = async (): Promise<void> => {
    const result = await window.scamp.chooseFolder();
    if (result.canceled || !result.path) return;
    const next = await window.scamp.setDefaultProjectsFolder(result.path);
    setSettings(next);
  };

  const handleClearFolder = async (): Promise<void> => {
    const next = await window.scamp.setDefaultProjectsFolder(null);
    setSettings(next);
  };

  const updateField = async <K extends keyof Settings>(
    key: K,
    value: Settings[K]
  ): Promise<void> => {
    const next = await window.scamp.updateSettings({ [key]: value });
    setSettings(next);
  };

  if (!settings) return <div className={styles.page} />;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={onBack} type="button">
          ← Back
        </button>
        <h1 className={styles.headerTitle}>Settings</h1>
      </div>

      <div className={styles.body}>
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>General</h2>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Default folder</span>
            <div className={styles.rowControl}>
              {settings.defaultProjectsFolder ? (
                <span
                  className={styles.folderPath}
                  title={settings.defaultProjectsFolder}
                >
                  {settings.defaultProjectsFolder}
                </span>
              ) : (
                <span className={styles.folderNone}>Not set</span>
              )}
              <button
                className={styles.smallButton}
                onClick={handlePickFolder}
                type="button"
              >
                {settings.defaultProjectsFolder ? 'Change' : 'Choose'}
              </button>
              {settings.defaultProjectsFolder && (
                <button
                  className={styles.smallButton}
                  onClick={handleClearFolder}
                  type="button"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Canvas</h2>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Artboard background</span>
            <div className={styles.rowControl}>
              <ColorInput
                value={settings.artboardBackground}
                onChange={(value) => updateField('artboardBackground', value)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
