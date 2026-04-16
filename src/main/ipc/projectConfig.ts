import { ipcMain } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';
import { IPC } from '@shared/ipcChannels';
import type {
  ProjectConfig,
  ProjectConfigReadArgs,
  ProjectConfigWriteArgs,
} from '@shared/types';
import { DEFAULT_PROJECT_CONFIG } from '@shared/types';
import {
  parseProjectConfig,
  serializeProjectConfig,
} from '@shared/projectConfig';

const CONFIG_FILE = 'scamp.config.json';

const readConfig = async (projectPath: string): Promise<ProjectConfig> => {
  try {
    const raw = await fs.readFile(join(projectPath, CONFIG_FILE), 'utf-8');
    return parseProjectConfig(raw);
  } catch {
    return { ...DEFAULT_PROJECT_CONFIG };
  }
};

const writeConfig = async (
  projectPath: string,
  config: ProjectConfig
): Promise<ProjectConfig> => {
  const path = join(projectPath, CONFIG_FILE);
  await fs.writeFile(path, serializeProjectConfig(config), 'utf-8');
  return config;
};

/**
 * Ensure a project folder has a `scamp.config.json`. Used on project
 * create and on open so older projects backfill to the defaults.
 * Returns the config currently on disk after the backfill.
 */
export const ensureProjectConfig = async (
  projectPath: string
): Promise<ProjectConfig> => {
  const path = join(projectPath, CONFIG_FILE);
  try {
    await fs.access(path);
    return readConfig(projectPath);
  } catch {
    return writeConfig(projectPath, { ...DEFAULT_PROJECT_CONFIG });
  }
};

export const registerProjectConfigIpc = (): void => {
  ipcMain.handle(
    IPC.ProjectConfigRead,
    async (_e, args: ProjectConfigReadArgs) => readConfig(args.projectPath)
  );
  ipcMain.handle(
    IPC.ProjectConfigWrite,
    async (_e, args: ProjectConfigWriteArgs) =>
      writeConfig(args.projectPath, args.config)
  );
};
