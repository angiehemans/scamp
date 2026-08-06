import { BrowserWindow } from 'electron';
import type { McpStatusResult } from '@shared/types';
/** Register the reply listener once, at app start. */
export declare const initMcp: (win: BrowserWindow) => void;
/**
 * Start (or restart) the server for a project.
 *
 * Called wherever `watchProject` is — opening a different project must move
 * the server with it, since every tool answers about whatever is on canvas.
 * Best-effort: a failure here must never block opening a project.
 */
export declare const startMcpForProject: (projectPath: string) => Promise<void>;
export declare const stopMcp: () => Promise<void>;
/** Drives the terminal indicator. */
export declare const mcpStatus: () => McpStatusResult;
