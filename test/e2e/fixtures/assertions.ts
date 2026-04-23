import { promises as fs } from 'fs';
import * as path from 'path';

export type PageFiles = {
  tsx: string;
  css: string;
};

export const readPageFiles = async (
  projectDir: string,
  pageName: string
): Promise<PageFiles> => {
  const [tsx, css] = await Promise.all([
    fs.readFile(path.join(projectDir, `${pageName}.tsx`), 'utf-8'),
    fs.readFile(path.join(projectDir, `${pageName}.module.css`), 'utf-8'),
  ]);
  return { tsx, css };
};

export const projectFileExists = async (
  projectDir: string,
  name: string
): Promise<boolean> => {
  try {
    await fs.access(path.join(projectDir, name));
    return true;
  } catch {
    return false;
  }
};
