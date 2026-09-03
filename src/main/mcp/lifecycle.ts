import { homedir } from 'os';
import { basename } from 'path';
import { BrowserWindow, ipcMain } from 'electron';

import { IPC } from '@shared/ipcChannels';
import type {
  McpQueryArgs,
  McpQueryResultArgs,
  McpStatusResult,
} from '@shared/types';

import { detectDisabledAgents, writeAgentConfigs } from './agentConfig';
import { ensureToken, markMcpStopped, writeMcpConfig } from './mcpOps';
import { createQueryRegistry, type QueryRegistry } from './pendingQueries';
import { startMcpServer, type RunningMcpServer } from './server';
import { createToolInvoker, TOOL_DESCRIPTORS } from './tools';

/**
 * The Electron glue: owns the window reference, the IPC listener, the query
 * registry, and the running server.
 *
 * Everything testable lives in its neighbours — this file exists so
 * `server.ts`, `tools.ts`, and `pendingQueries.ts` never import Electron and
 * can be unit tested without an app.
 * see docs/plans/mcp-server-plan.md
 */

let mainWindow: BrowserWindow | null = null;
let registry: QueryRegistry | null = null;
let running: RunningMcpServer | null = null;
let activeProject: string | null = null;
let activeToken: string | null = null;
let registered: string[] = [];
let agentSeen = false;

/** Register the reply listener once, at app start. */
export const initMcp = (win: BrowserWindow): void => {
  mainWindow = win;
  ipcMain.removeAllListeners(IPC.McpQueryResult);
  ipcMain.on(IPC.McpQueryResult, (_e, result: McpQueryResultArgs) => {
    registry?.resolve(result);
  });
  ipcMain.removeHandler(IPC.McpStatus);
  ipcMain.handle(IPC.McpStatus, (): Promise<McpStatusResult> => mcpStatus());
};

const send = (payload: McpQueryArgs): void => {
  const win = mainWindow;
  // Guard both: the window can be destroyed between a tool call arriving and
  // this send, and a destroyed window's webContents throws on send.
  if (win === null || win.isDestroyed()) {
    throw new Error('The Scamp window is not available.');
  }
  win.webContents.send(IPC.McpQuery, payload);
};

/**
 * Start (or restart) the server for a project.
 *
 * Called wherever `watchProject` is — opening a different project must move
 * the server with it, since every tool answers about whatever is on canvas.
 * Best-effort: a failure here must never block opening a project.
 */
export const startMcpForProject = async (projectPath: string): Promise<void> => {
  await stopMcp();
  try {
    const token = await ensureToken(projectPath);
    registry = createQueryRegistry({ send });
    agentSeen = false;
    running = await startMcpServer({
      token,
      onAuthenticatedRequest: () => {
        agentSeen = true;
      },
      deps: {
        tools: TOOL_DESCRIPTORS,
        invoke: createToolInvoker((tool, args) =>
          registry === null
            ? Promise.reject(new Error('The Scamp MCP server is not running.'))
            : registry.query(tool, args)
        ),
      },
    });
    activeProject = projectPath;
    activeToken = token;
    await writeMcpConfig(projectPath, {
      url: running.url,
      token,
      running: true,
      started_at: new Date().toISOString(),
      project: basename(projectPath),
    });

    // Register with every installed agent so the user runs no command.
    // Failures here are reported, never thrown: a config we couldn't merge
    // must not stop the server the user can still connect to by hand.
    const report = await writeAgentConfigs({
      projectPath,
      homeDir: homedir(),
      url: running.url,
      token,
    });
    registered = [...report.written];
    for (const skip of report.skipped) {
      console.warn(`[mcp] skipped ${skip.path}: ${skip.reason}`);
    }
  } catch (err) {
    // A port collision or unwritable `.scamp/` should degrade to "no MCP",
    // not to "the project won't open".
    console.error('[mcp] failed to start:', err);
    await stopMcp();
  }
};

export const stopMcp = async (): Promise<void> => {
  // Fail in-flight queries before closing the socket, so a waiting agent gets
  // a reason rather than a timeout.
  registry?.rejectAll('The Scamp MCP server is shutting down.');
  registry = null;

  const server = running;
  running = null;
  if (server !== null) await server.close();

  const project = activeProject;
  activeProject = null;
  activeToken = null;
  registered = [];
  agentSeen = false;
  if (project !== null) await markMcpStopped(project);
};

/** Drives the terminal indicator. */
export const mcpStatus = async (): Promise<McpStatusResult> => ({
  running: running !== null,
  url: running?.url ?? null,
  token: activeToken,
  registered: [...registered],
  agentConnected: agentSeen,
  disabledIn: activeProject === null ? [] : await detectDisabledAgents(activeProject),
});
