import { type Dispatch, type MouseEvent as ReactMouseEvent, type SetStateAction } from 'react';
import type { PageFile } from '@shared/types';
import type { ActiveComponent, PageEdit } from './types';
type Props = {
    pages: PageFile[];
    existingPageNames: string[];
    pageEdit: PageEdit;
    pageEditError: string | null;
    pageEditBusy: boolean;
    isEditingPage: boolean;
    activePageName: string | null;
    activeComponent: ActiveComponent | null;
    setPageEdit: Dispatch<SetStateAction<PageEdit>>;
    setPageEditError: Dispatch<SetStateAction<string | null>>;
    resetPageEdit: () => void;
    handleAddPage: (name: string) => Promise<void>;
    handleDuplicatePage: (sourcePageName: string, newName: string) => Promise<void>;
    handleRenamePage: (oldName: string, newName: string) => Promise<void>;
    openPageMenu: (e: ReactMouseEvent, pageName: string) => void;
    persistActiveSource: () => void;
    setActiveComponentState: (next: ActiveComponent | null) => void;
    setActivePageName: (name: string | null) => void;
};
/** The Pages section of the left sidebar: page list + inline add/rename. */
export declare const PageSidebar: ({ pages, existingPageNames, pageEdit, pageEditError, pageEditBusy, isEditingPage, activePageName, activeComponent, setPageEdit, setPageEditError, resetPageEdit, handleAddPage, handleDuplicatePage, handleRenamePage, openPageMenu, persistActiveSource, setActiveComponentState, setActivePageName, }: Props) => JSX.Element;
export {};
