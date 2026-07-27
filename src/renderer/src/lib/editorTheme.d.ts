import type { Extension } from '@codemirror/state';
import type { AppTheme } from '@shared/types';
/** The CodeMirror theme extension for the active app chrome theme. */
export declare const editorThemeFor: (theme: AppTheme) => Extension;
