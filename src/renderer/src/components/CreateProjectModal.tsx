import { useEffect, useRef, useState } from 'react';
import { suggestProjectName, validateProjectName } from '@shared/projectName';
import { useDialogBackdrop } from '../hooks/useDialogBackdrop';
import { Button } from './controls/Button';
import styles from './CreateProjectModal.module.css';

type Props = {
  defaultFolder: string;
  onSubmit: (name: string) => Promise<void>;
  onCancel: () => void;
};

/**
 * Modal dialog for creating a new project. Handles name input, validation,
 * auto-suggest on blur, and path hint. The parent owns the actual IPC call
 * and passes it via `onSubmit`.
 */
export const CreateProjectModal = ({
  defaultFolder,
  onSubmit,
  onCancel,
}: Props): JSX.Element => {
  const [draftName, setDraftName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input on mount.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useDialogBackdrop({ onClose: onCancel, disabled: creating });

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const validation = validateProjectName(draftName);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    setError(null);
    setCreating(true);
    try {
      await onSubmit(validation.value);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setCreating(false);
    }
  };

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget && !creating) onCancel();
      }}
    >
      <form className={styles.dialog} onSubmit={handleSubmit}>
        <h2 className={styles.title}>New Project</h2>
        <label className={styles.label} htmlFor="modal-project-name">
          Project name
        </label>
        <input
          ref={inputRef}
          id="modal-project-name"
          className={styles.input}
          type="text"
          value={draftName}
          onChange={(e) => {
            setDraftName(e.target.value);
            setError(null);
          }}
          onBlur={(e) => {
            const suggestion = suggestProjectName(e.target.value);
            if (suggestion && suggestion !== e.target.value) {
              setDraftName(suggestion);
            }
          }}
          placeholder="my-portfolio"
          disabled={creating}
        />
        <p className={styles.hint}>
          Will be created at{' '}
          <code className={styles.hintCode}>
            {defaultFolder}/{draftName || '<name>'}
          </code>
        </p>
        {error && <div className={styles.error}>{error}</div>}
        <div className={styles.actions}>
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={creating}
            fullWidth
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={creating}
            fullWidth
          >
            {creating ? 'Creating...' : 'Create Project'}
          </Button>
        </div>
      </form>
    </div>
  );
};
