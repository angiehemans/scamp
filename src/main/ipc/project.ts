import { dialog, ipcMain } from 'electron';
import { promises as fs } from 'fs';
import { basename, join } from 'path';
import { IPC } from '@shared/ipcChannels';
import type {
  ChooseFolderResult,
  CreateProjectArgs,
  OpenProjectArgs,
  PageFile,
  ProjectData,
} from '@shared/types';
import {
  AGENT_MD_CONTENT,
  DEFAULT_PAGE_CSS,
  DEFAULT_THEME_CSS,
  defaultPageTsx,
} from '@shared/agentMd';
import { validateProjectName } from '@shared/projectName';
import { addRecentProject } from './recentProjects';
import { watchProject } from '../watcher';
import { ensureProjectConfig } from './projectConfig';

const chooseFolder = async (): Promise<ChooseFolderResult> => {
  const result = await dialog.showOpenDialog({
    title: 'Choose project folder',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true, path: null };
  }
  return { canceled: false, path: result.filePaths[0] ?? null };
};

const componentNameFromPage = (pageName: string): string => {
  return pageName
    .split(/[-_]/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
};

const readProject = async (folderPath: string): Promise<ProjectData> => {
  const entries = await fs.readdir(folderPath);
  const tsxFiles = entries.filter((f) => f.endsWith('.tsx'));

  const pages: PageFile[] = [];
  for (const tsxFile of tsxFiles) {
    const baseName = tsxFile.replace(/\.tsx$/, '');
    const cssFile = `${baseName}.module.css`;
    if (!entries.includes(cssFile)) continue;
    const tsxPath = join(folderPath, tsxFile);
    const cssPath = join(folderPath, cssFile);
    const [tsxContent, cssContent] = await Promise.all([
      fs.readFile(tsxPath, 'utf-8'),
      fs.readFile(cssPath, 'utf-8'),
    ]);
    pages.push({ name: baseName, tsxPath, cssPath, tsxContent, cssContent });
  }

  return {
    path: folderPath,
    name: basename(folderPath),
    pages,
  };
};

const createProject = async (args: CreateProjectArgs): Promise<ProjectData> => {
  // Re-validate the name on the main side — never trust the renderer.
  const result = validateProjectName(args.name);
  if (!result.ok) throw new Error(result.error);
  const name = result.value;

  // The parent must exist; we don't auto-create it because that's the
  // user's "default projects folder" and creating it silently would mask
  // a misconfiguration.
  try {
    const stat = await fs.stat(args.parentPath);
    if (!stat.isDirectory()) {
      throw new Error(`Parent path is not a directory: ${args.parentPath}`);
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Parent path is not')) throw e;
    throw new Error(`Parent folder does not exist: ${args.parentPath}`);
  }

  const projectPath = join(args.parentPath, name);

  // Refuse to write into a folder that already exists. The user can pick
  // a different name; we never want to silently merge into a stranger's
  // folder.
  try {
    await fs.access(projectPath);
    throw new Error(`A folder named "${name}" already exists at ${args.parentPath}.`);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('A folder named')) throw e;
    // ENOENT — proceed
  }

  await fs.mkdir(projectPath, { recursive: false });

  const agentPath = join(projectPath, 'agent.md');
  await fs.writeFile(agentPath, AGENT_MD_CONTENT, 'utf-8');

  const pageName = 'home';
  const componentName = componentNameFromPage(pageName);
  await fs.writeFile(
    join(projectPath, `${pageName}.tsx`),
    defaultPageTsx(componentName, pageName),
    'utf-8'
  );
  await fs.writeFile(
    join(projectPath, `${pageName}.module.css`),
    DEFAULT_PAGE_CSS,
    'utf-8'
  );
  await fs.writeFile(
    join(projectPath, 'theme.css'),
    DEFAULT_THEME_CSS,
    'utf-8'
  );
  await ensureProjectConfig(projectPath);

  await addRecentProject({ name, path: projectPath });
  await watchProject(projectPath);
  return readProject(projectPath);
};

const openProject = async (args: OpenProjectArgs): Promise<ProjectData> => {
  const project = await readProject(args.folderPath);
  // Ensure older projects get a theme.css if they don't have one.
  const themePath = join(args.folderPath, 'theme.css');
  try {
    await fs.access(themePath);
  } catch {
    await fs.writeFile(themePath, DEFAULT_THEME_CSS, 'utf-8');
  }
  // Backfill scamp.config.json with defaults for projects created
  // before per-project settings existed.
  await ensureProjectConfig(args.folderPath);
  await addRecentProject({ name: project.name, path: project.path });
  await watchProject(args.folderPath);
  return project;
};

export const registerProjectIpc = (): void => {
  ipcMain.handle(IPC.ProjectChooseFolder, () => chooseFolder());
  ipcMain.handle(IPC.ProjectCreate, (_e, args: CreateProjectArgs) => createProject(args));
  ipcMain.handle(IPC.ProjectOpen, (_e, args: OpenProjectArgs) => openProject(args));
  ipcMain.handle(IPC.ProjectRead, (_e, args: OpenProjectArgs) => readProject(args.folderPath));
};
