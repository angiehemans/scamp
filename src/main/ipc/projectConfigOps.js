import { promises as fs } from 'fs';
import { join } from 'path';
import { DEFAULT_PROJECT_CONFIG } from '@shared/types';
import { parseProjectConfig, serializeProjectConfig, } from '@shared/projectConfig';
export const CONFIG_FILE = 'scamp.config.json';
/** Read `scamp.config.json` from a project, defaulting if absent/invalid. */
export const readConfig = async (projectPath) => {
    try {
        const raw = await fs.readFile(join(projectPath, CONFIG_FILE), 'utf-8');
        return parseProjectConfig(raw);
    }
    catch {
        return { ...DEFAULT_PROJECT_CONFIG };
    }
};
/** Write `scamp.config.json` and return the config that was written. */
export const writeConfig = async (projectPath, config) => {
    await fs.writeFile(join(projectPath, CONFIG_FILE), serializeProjectConfig(config), 'utf-8');
    return config;
};
/**
 * Ensure a project folder has a `scamp.config.json`. Used on project
 * create and on open so older projects backfill to the defaults.
 * Returns the config currently on disk after the backfill.
 */
export const ensureProjectConfig = async (projectPath) => {
    const path = join(projectPath, CONFIG_FILE);
    try {
        await fs.access(path);
        return readConfig(projectPath);
    }
    catch {
        return writeConfig(projectPath, { ...DEFAULT_PROJECT_CONFIG });
    }
};
