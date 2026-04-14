import { useCallback, useEffect, useState } from 'react';
import type { ProjectData, RecentProject, Settings } from '@shared/types';
import { basename } from '../lib/path';
import { CreateProjectModal } from './CreateProjectModal';
import { Tooltip } from './controls/Tooltip';
import styles from './StartScreen.module.css';

type RecentProjectWithExistence = RecentProject & { exists: boolean };

type Props = {
  onProjectOpened: (project: ProjectData) => void;
  onOpenSettings: () => void;
};

export const StartScreen = ({ onProjectOpened, onOpenSettings }: Props): JSX.Element => {
  const [recents, setRecents] = useState<RecentProjectWithExistence[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const refreshRecents = useCallback(async (): Promise<void> => {
    const list = await window.scamp.getRecentProjects();
    setRecents(list);
  }, []);

  const refreshSettings = useCallback(async (): Promise<void> => {
    const next = await window.scamp.getSettings();
    setSettings(next);
  }, []);

  useEffect(() => {
    void refreshRecents();
    void refreshSettings();
  }, [refreshRecents, refreshSettings]);

  const defaultFolder = settings?.defaultProjectsFolder ?? null;

  const handlePickDefaultFolder = async (): Promise<void> => {
    setError(null);
    try {
      const result = await window.scamp.chooseFolder();
      if (result.canceled || !result.path) return;
      const next = await window.scamp.setDefaultProjectsFolder(result.path);
      if (next && typeof next === 'object' && 'defaultProjectsFolder' in next) {
        setSettings(next);
      } else {
        await refreshSettings();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleClearDefaultFolder = async (): Promise<void> => {
    setError(null);
    try {
      const next = await window.scamp.setDefaultProjectsFolder(null);
      if (next && typeof next === 'object' && 'defaultProjectsFolder' in next) {
        setSettings(next);
      } else {
        await refreshSettings();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleCreateProject = async (name: string): Promise<void> => {
    if (!defaultFolder) return;
    const project = await window.scamp.createProject({
      parentPath: defaultFolder,
      name,
    });
    onProjectOpened(project);
  };

  const handleOpenProject = async (): Promise<void> => {
    setError(null);
    const result = await window.scamp.chooseFolder();
    if (result.canceled || !result.path) return;
    try {
      const project = await window.scamp.openProject({ folderPath: result.path });
      onProjectOpened(project);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleOpenRecent = async (recent: RecentProjectWithExistence): Promise<void> => {
    if (!recent.exists) return;
    setError(null);
    try {
      const project = await window.scamp.openProject({ folderPath: recent.path });
      onProjectOpened(project);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleRemoveRecent = async (path: string): Promise<void> => {
    await window.scamp.removeRecentProject(path);
    await refreshRecents();
  };

  // ---- Render ----

  const renderMain = (): JSX.Element => {
    // First-run: no default folder yet.
    if (settings && !defaultFolder) {
      return (
        <div className={styles.welcomeState}>
          <h2 className={styles.welcomeHeading}>Welcome to Scamp</h2>
          <p className={styles.welcomeText}>
            Pick a default folder where new projects will live. Each project
            gets its own subfolder inside it. You can change this later.
          </p>
          <button
            className={styles.welcomeButton}
            onClick={handlePickDefaultFolder}
            type="button"
          >
            Choose Folder
          </button>
        </div>
      );
    }

    return (
      <>
        <h2 className={styles.recentTitle}>Recent Projects</h2>
        {error && <div className={styles.error}>{error}</div>}
        {recents.length === 0 ? (
          <div className={styles.emptyState}>No recent projects yet.</div>
        ) : (
          <ul className={styles.recentList}>
            {recents.map((recent) => (
              <li
                key={recent.path}
                className={`${styles.recentItem} ${recent.exists ? '' : styles.recentMissing}`}
              >
                <button
                  className={styles.recentButton}
                  onClick={() => handleOpenRecent(recent)}
                  disabled={!recent.exists}
                  type="button"
                >
                  <span className={styles.recentName}>{recent.name}</span>
                  <span className={styles.recentPath}>{recent.path}</span>
                  {!recent.exists && (
                    <span className={styles.recentLabel}>Folder not found</span>
                  )}
                </button>
                <Tooltip label="Remove from list">
                  <button
                    className={styles.recentRemove}
                    onClick={() => handleRemoveRecent(recent.path)}
                    type="button"
                  >
                    x
                  </button>
                </Tooltip>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  };

  return (
    <div className={styles.screen}>
      <aside className={styles.sidebar}>
        <h1 className={styles.sidebarTitle}>Scamp</h1>
        <p className={styles.sidebarSubtitle}>Local design tool — draw, get real code.</p>

        <div className={styles.sidebarActions}>
          <button
            className={styles.primary}
            onClick={() => setShowCreateModal(true)}
            type="button"
            disabled={!defaultFolder}
          >
            New Project
          </button>
          <button
            className={styles.secondary}
            onClick={handleOpenProject}
            type="button"
          >
            Open Project
          </button>
        </div>

        <div className={styles.sidebarSpacer} />

        <button
          className={styles.linkButton}
          onClick={onOpenSettings}
          type="button"
          style={{ marginBottom: 16 }}
        >
          Settings
        </button>

        {defaultFolder && (
          <div className={styles.sidebarFooter}>
            <span className={styles.footerLabel}>Default folder</span>
            <Tooltip label={defaultFolder}>
              <span className={styles.footerPath}>{defaultFolder}</span>
            </Tooltip>
            <div className={styles.footerLinks}>
              <button
                className={styles.linkButton}
                onClick={handlePickDefaultFolder}
                type="button"
              >
                Change
              </button>
              <button
                className={styles.linkButton}
                onClick={handleClearDefaultFolder}
                type="button"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </aside>

      <main className={styles.main}>{renderMain()}</main>

      {showCreateModal && defaultFolder && (
        <CreateProjectModal
          defaultFolder={defaultFolder}
          onSubmit={handleCreateProject}
          onCancel={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
};

export const projectNameFromPath = (p: string): string => basename(p);
