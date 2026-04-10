import { ipcMain } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';
import { IPC } from '@shared/ipcChannels';

/**
 * Read the project's theme.css. Returns the file content as a string,
 * or an empty string if the file doesn't exist.
 */
const readTheme = async (projectPath: string): Promise<string> => {
  try {
    return await fs.readFile(join(projectPath, 'theme.css'), 'utf-8');
  } catch {
    return '';
  }
};

/**
 * Write the project's theme.css, replacing its entire content.
 */
const writeTheme = async (args: {
  projectPath: string;
  content: string;
}): Promise<void> => {
  await fs.writeFile(join(args.projectPath, 'theme.css'), args.content, 'utf-8');
};

export const registerThemeIpc = (): void => {
  ipcMain.handle(
    IPC.ThemeRead,
    async (_e, args: { projectPath: string }) => readTheme(args.projectPath)
  );
  ipcMain.handle(
    IPC.ThemeWrite,
    async (_e, args: { projectPath: string; content: string }) => writeTheme(args)
  );
};
