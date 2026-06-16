import { type Dispatch, type MouseEvent as ReactMouseEvent, type SetStateAction } from 'react';

import type { ComponentFile } from '@shared/types';

import { ComponentNameInput } from '../ComponentNameInput';
import { ComponentSidebarItem } from '../ComponentSidebarItem';
import type { ActiveComponent, ComponentEdit } from './types';
import styles from '../ProjectShell.module.css';

type Props = {
  components: ComponentFile[];
  projectPath: string;
  componentEdit: ComponentEdit;
  componentEditError: string | null;
  renamingComponent: boolean;
  creatingComponent: boolean;
  activeComponent: ActiveComponent | null;
  setComponentEdit: Dispatch<SetStateAction<ComponentEdit>>;
  setComponentEditError: Dispatch<SetStateAction<string | null>>;
  handleAddComponent: (name: string) => Promise<void>;
  handleRenameComponent: (oldName: string, newName: string) => Promise<void>;
  openComponent: (name: string, fromPage: string | null) => void;
  openComponentMenu: (e: ReactMouseEvent, componentName: string) => void;
};

/** The Components section of the left sidebar: list + inline add/rename. */
export const ComponentSidebar = ({
  components,
  projectPath,
  componentEdit,
  componentEditError,
  renamingComponent,
  creatingComponent,
  activeComponent,
  setComponentEdit,
  setComponentEditError,
  handleAddComponent,
  handleRenameComponent,
  openComponent,
  openComponentMenu,
}: Props): JSX.Element => {
  return (
    <div className={styles.sidebarSection}>
      <h2 className={styles.sidebarTitle}>Components</h2>
      <ul className={styles.pageList}>
        {components.map((component) => {
          const isRenaming =
            componentEdit !== null &&
            componentEdit !== 'new' &&
            componentEdit.rename === component.name;
          if (isRenaming) {
            return (
              <li key={component.name}>
                <ComponentNameInput
                  initialValue={component.name}
                  existingNames={components
                    .map((c) => c.name)
                    .filter((n) => n !== component.name)}
                  onConfirm={(name) =>
                    void handleRenameComponent(component.name, name)
                  }
                  onCancel={() => {
                    if (renamingComponent) return;
                    setComponentEdit(null);
                    setComponentEditError(null);
                  }}
                  error={componentEditError}
                  busy={renamingComponent}
                />
              </li>
            );
          }
          return (
            <li key={component.name}>
              <ComponentSidebarItem
                componentName={component.name}
                projectPath={projectPath}
                isActive={activeComponent?.name === component.name}
                onClick={() => openComponent(component.name, null)}
                onContextMenu={(e) =>
                  openComponentMenu(e, component.name)
                }
                // HTML5 DnD source: dragging a component onto
                // the canvas inserts an instance there. The
                // Viewport's drop handler reads this
                // dataTransfer mime to distinguish a
                // component-drag from any other drag.
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    'application/x-scamp-component',
                    component.name
                  );
                  e.dataTransfer.effectAllowed = 'copy';
                }}
              />
            </li>
          );
        })}
        {componentEdit === 'new' && (
          <li>
            <ComponentNameInput
              existingNames={components.map((c) => c.name)}
              onConfirm={(name) => void handleAddComponent(name)}
              onCancel={() => {
                setComponentEdit(null);
                setComponentEditError(null);
              }}
              error={componentEditError}
              busy={creatingComponent}
            />
          </li>
        )}
      </ul>
      {componentEdit === null && (
        <button
          className={styles.addPageButton}
          onClick={() => {
            setComponentEditError(null);
            setComponentEdit('new');
          }}
          type="button"
        >
          + Add Component
        </button>
      )}
    </div>
  );
};
