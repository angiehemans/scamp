import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  CLAUDE_CODE_LOCAL_SETTINGS,
  detectDisabledAgents,
} from '../../src/main/mcp/agentConfig';

describe('detectDisabledAgents', () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = await fs.mkdtemp(join(tmpdir(), 'scamp-mcp-disabled-'));
  });

  afterEach(async () => {
    await fs.rm(projectDir, { recursive: true, force: true });
  });

  it('reports nothing for a project with no local settings', async () => {
    expect(await detectDisabledAgents(projectDir)).toEqual([]);
  });

  it('reports Claude Code when its local settings disable scamp', async () => {
    const path = join(projectDir, CLAUDE_CODE_LOCAL_SETTINGS);
    await fs.mkdir(join(projectDir, '.claude'), { recursive: true });
    await fs.writeFile(path, '{"disabledMcpjsonServers": ["scamp"]}\n', 'utf-8');
    expect(await detectDisabledAgents(projectDir)).toEqual(['Claude Code']);
  });

  it('clears as soon as the entry is removed', async () => {
    const path = join(projectDir, CLAUDE_CODE_LOCAL_SETTINGS);
    await fs.mkdir(join(projectDir, '.claude'), { recursive: true });
    await fs.writeFile(path, '{"disabledMcpjsonServers": ["scamp"]}\n', 'utf-8');
    expect(await detectDisabledAgents(projectDir)).toEqual(['Claude Code']);
    await fs.writeFile(path, '{"disabledMcpjsonServers": []}\n', 'utf-8');
    expect(await detectDisabledAgents(projectDir)).toEqual([]);
  });
});
