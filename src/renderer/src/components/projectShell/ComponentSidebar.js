import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ComponentNameInput } from '../ComponentNameInput';
import { ComponentSidebarItem } from '../ComponentSidebarItem';
import styles from '../ProjectShell.module.css';
/** The Components section of the left sidebar: list + inline add/rename. */
export const ComponentSidebar = ({ components, projectPath, componentEdit, componentEditError, renamingComponent, creatingComponent, activeComponent, setComponentEdit, setComponentEditError, handleAddComponent, handleRenameComponent, openComponent, openComponentMenu, }) => {
    return (_jsxs("div", { className: styles.sidebarSection, children: [_jsx("h2", { className: styles.sidebarTitle, children: "Components" }), _jsxs("ul", { className: styles.pageList, children: [components.map((component) => {
                        const isRenaming = componentEdit !== null &&
                            componentEdit !== 'new' &&
                            componentEdit.rename === component.name;
                        if (isRenaming) {
                            return (_jsx("li", { children: _jsx(ComponentNameInput, { initialValue: component.name, existingNames: components
                                        .map((c) => c.name)
                                        .filter((n) => n !== component.name), onConfirm: (name) => void handleRenameComponent(component.name, name), onCancel: () => {
                                        if (renamingComponent)
                                            return;
                                        setComponentEdit(null);
                                        setComponentEditError(null);
                                    }, error: componentEditError, busy: renamingComponent }) }, component.name));
                        }
                        return (_jsx("li", { children: _jsx(ComponentSidebarItem, { componentName: component.name, projectPath: projectPath, isActive: activeComponent?.name === component.name, onClick: () => openComponent(component.name, null), onContextMenu: (e) => openComponentMenu(e, component.name), 
                                // HTML5 DnD source: dragging a component onto
                                // the canvas inserts an instance there. The
                                // Viewport's drop handler reads this
                                // dataTransfer mime to distinguish a
                                // component-drag from any other drag.
                                onDragStart: (e) => {
                                    e.dataTransfer.setData('application/x-scamp-component', component.name);
                                    e.dataTransfer.effectAllowed = 'copy';
                                } }) }, component.name));
                    }), componentEdit === 'new' && (_jsx("li", { children: _jsx(ComponentNameInput, { existingNames: components.map((c) => c.name), onConfirm: (name) => void handleAddComponent(name), onCancel: () => {
                                setComponentEdit(null);
                                setComponentEditError(null);
                            }, error: componentEditError, busy: creatingComponent }) }))] }), componentEdit === null && (_jsx("button", { className: styles.addPageButton, onClick: () => {
                    setComponentEditError(null);
                    setComponentEdit('new');
                }, type: "button", children: "+ Add Component" }))] }));
};
