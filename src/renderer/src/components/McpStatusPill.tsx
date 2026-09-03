import { useCallback, useEffect, useState } from 'react';
import { IconCheck, IconCopy } from '@tabler/icons-react';

import type { McpStatusResult } from '@shared/types';

import { Tooltip } from './controls/Tooltip';
import styles from './McpStatusPill.module.css';

/**
 * Tells the user the MCP server exists, whether an agent is actually
 * using it, and offers the right command as a fallback.
 *
 * "Running" alone was a lie by omission: it stayed green while Claude
 * Code had silently declined the server and never connected. The pill
 * now has three states — connected, waiting, disabled — and the copy
 * button hands over whichever command fixes the current one.
 * see docs/notes/mcp-server.md
 */

const COPIED_FEEDBACK_MS = 1200;
/** Agents connect at their own pace; a few seconds is plenty. */
const POLL_MS = 4000;

const connectCommand = (url: string, token: string): string =>
  `claude mcp add --transport http scamp "${url}" --header "X-Scamp-Token: ${token}"`;

/** Clears a declined `.mcp.json` prompt so Claude Code asks again. */
const RESET_COMMAND = 'claude mcp reset-project-choices';

type AgentState = 'connected' | 'waiting' | 'disabled';

const agentStateOf = (status: McpStatusResult): AgentState => {
  if (status.disabledIn.length > 0) return 'disabled';
  return status.agentConnected ? 'connected' : 'waiting';
};

const tooltipFor = (status: McpStatusResult, state: AgentState): string => {
  const registered = status.registered;
  const where =
    registered.length > 0
      ? `Registered in ${registered.join(', ')}.`
      : 'No agent config was written; copy the connect command instead.';
  switch (state) {
    case 'disabled':
      return `${status.disabledIn.join(', ')} has this server disabled for this project — the .mcp.json prompt was declined, so it never connects. Click to copy \`${RESET_COMMAND}\`, run it in the project folder, then restart the agent and approve.`;
    case 'connected':
      return `Scamp MCP server is running and an agent is connected. ${where} Copy the connect command for agents Scamp cannot configure.`;
    case 'waiting':
      return `Scamp MCP server is running — no agent has connected yet. ${where} First use may need approval inside your agent. Copy the connect command for agents Scamp cannot configure.`;
  }
};

export const McpStatusPill = (): JSX.Element | null => {
  const [status, setStatus] = useState<McpStatusResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const refresh = (): void => {
      void window.scamp
        .getMcpStatus()
        .then((next) => {
          if (!cancelled) setStatus(next);
        })
        .catch(() => {
          // No status is the same as no server for display purposes.
        });
    };
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = useCallback(() => {
    if (status?.url == null || status.token == null) return;
    const text =
      agentStateOf(status) === 'disabled'
        ? RESET_COMMAND
        : connectCommand(status.url, status.token);
    void window.scamp
      .writeClipboard({ text })
      // Only claim success when the write actually happened.
      .then(() => setCopied(true))
      .catch(() => undefined);
  }, [status]);

  // Absent rather than greyed out: with no server there is nothing to say,
  // and a permanently dead indicator is worse than none.
  if (status === null || !status.running || status.url === null) return null;

  const state = agentStateOf(status);
  const copyLabel =
    state === 'disabled' ? 'Copy MCP reset command' : 'Copy MCP connect command';

  return (
    <Tooltip label={tooltipFor(status, state)}>
      <div
        className={styles.pill}
        data-testid="mcp-status"
        data-running="true"
        data-agent={state}
      >
        <span className={styles.dot} data-state={state} aria-hidden="true" />
        <span className={styles.label}>MCP</span>
        <button
          className={styles.copy}
          onClick={handleCopy}
          type="button"
          aria-label={copyLabel}
          data-action="copy-mcp-command"
          data-copied={copied ? 'true' : 'false'}
        >
          {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
        </button>
      </div>
    </Tooltip>
  );
};
