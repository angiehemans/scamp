import { useCallback, useEffect, useState } from 'react';
import type { ProjectData, RecentProject, Settings } from '@shared/types';
import { suggestProjectName, validateProjectName } from '@shared/projectName';
import { basename } from '../lib/path';
import styles from './StartScreen.module.css';

type RecentProjectWithExistence = RecentProject & { exists: boolean };

type Props = {
  onProjectOpened: (project: ProjectData) => void;
};

type CreateMode = 'idle' | 'naming';

export const StartScreen = ({ onProjectOpened }: Props): JSX.Element => {
  const [recents, setRecents] = useState<RecentProjectWithExistence[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState<CreateMode>('idle');
  const [draftName, setDraftName] = useState('');
  const [creating, setCreating] = useState(false);

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
      // Defensive: if the IPC ever returns something unexpected, refetch
      // from the source of truth so the UI is never out of sync with disk.
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
      setCreateMode('idle');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleStartCreate = (): void => {
    if (!defaultFolder) return;
    setError(null);
    setDraftName('');
    setCreateMode('naming');
  };

  const handleCancelCreate = (): void => {
    setCreateMode('idle');
    setDraftName('');
    setError(null);
  };

  const handleSubmitCreate = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    if (!defaultFolder) return;
    const validation = validateProjectName(draftName);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    setError(null);
    setCreating(true);
    try {
      const project = await window.scamp.createProject({
        parentPath: defaultFolder,
        name: validation.value,
      });
      onProjectOpened(project);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
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

  // First-run state: no default folder yet. Show a focused setup card.
  if (settings && !defaultFolder) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.title}>Welcome to Scamp</h1>
          <p className={styles.subtitle}>
            Pick a default folder where new projects will live. Each project gets its own
            subfolder inside it. You can change this later.
          </p>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.actions}>
            <button
              className={styles.primary}
              onClick={handlePickDefaultFolder}
              type="button"
            >
              Choose Folder
            </button>
            <button className={styles.secondary} onClick={handleOpenProject} type="button">
              Open Existing Project
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Scamp</h1>
        <p className={styles.subtitle}>Local design tool — draw, get real code.</p>

        {createMode === 'idle' ? (
          <div className={styles.actions}>
            <button
              className={styles.primary}
              onClick={handleStartCreate}
              type="button"
              disabled={!defaultFolder}
            >
              New Project
            </button>
            <button className={styles.secondary} onClick={handleOpenProject} type="button">
              Open Project
            </button>
          </div>
        ) : (
          <form className={styles.createForm} onSubmit={handleSubmitCreate}>
            <label className={styles.formLabel} htmlFor="project-name-input">
              Project name
            </label>
            <input
              id="project-name-input"
              className={styles.input}
              type="text"
              value={draftName}
              onChange={(e) => {
                setDraftName(e.target.value);
                setError(null);
              }}
              onBlur={(e) => {
                // Soft-suggest a valid name from whatever the user typed.
                const suggestion = suggestProjectName(e.target.value);
                if (suggestion && suggestion !== e.target.value) {
                  setDraftName(suggestion);
                }
              }}
              placeholder="my-portfolio"
              autoFocus
              disabled={creating}
            />
            <p className={styles.formHint}>
              Will be created at{' '}
              <code className={styles.pathHint}>
                {defaultFolder}/{draftName || '<name>'}
              </code>
            </p>
            {error && <div className={styles.error}>{error}</div>}
            <div className={styles.formActions}>
              <button
                className={styles.secondary}
                type="button"
                onClick={handleCancelCreate}
                disabled={creating}
              >
                Cancel
              </button>
              <button className={styles.primary} type="submit" disabled={creating}>
                {creating ? 'Creating…' : 'Create Project'}
              </button>
            </div>
          </form>
        )}

        {createMode === 'idle' && error && <div className={styles.error}>{error}</div>}

        <div className={styles.defaultFolderRow}>
          <span className={styles.defaultFolderLabel}>Default folder</span>
          <code className={styles.defaultFolderPath} title={defaultFolder ?? ''}>
            {defaultFolder}
          </code>
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
            title="Forget the default folder"
          >
            Clear
          </button>
        </div>

        <h2 className={styles.recentTitle}>Recent Projects</h2>
        {recents.length === 0 ? (
          <p className={styles.empty}>No recent projects yet.</p>
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
                  {!recent.exists && <span className={styles.recentLabel}>Folder not found</span>}
                </button>
                <button
                  className={styles.recentRemove}
                  onClick={() => handleRemoveRecent(recent.path)}
                  title="Remove from list"
                  type="button"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

// Re-export for any consumer that wants to compute a fallback project display
// name from a free-form folder path.
export const projectNameFromPath = (p: string): string => basename(p);
