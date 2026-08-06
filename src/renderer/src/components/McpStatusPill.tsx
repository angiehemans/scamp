import { useCallback, useEffect, useState } from 'react';
import { IconCheck, IconCopy } from '@tabler/icons-react';

import type { McpStatusResult } from '@shared/types';

import { Tooltip } from './controls/Tooltip';
import styles from './McpStatusPill.module.css';

/**
 * Tells the user the MCP server exists, and offers the connect command as a
 * fallback.
 *
 * The status half is the important half. Scamp registers the server in each
 * installed agent's config automatically, so there's no command to run — but
 * a capability nobody knows about goes unused, and a silent feature reads as
 * a missing one. The copy button covers the cases auto-registration doesn't:
 * an agent we can't configure yet (VS Code, Codex), or a session that was
 * already running when the project opened.
 * see docs/plans/mcp-server-plan.md
 */

const COPIED_FEEDBACK_MS = 1200;

const connectCommand = (url: string, token: string): string =>
  `claude mcp add --transport http scamp "${url}" --header "X-Scamp-Token: ${token}"`;

export const McpStatusPill = (): JSX.Element | null => {
  const [status, setStatus] = useState<McpStatusResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void window.scamp
      .getMcpStatus()
      .then((next) => {
        if (!cancelled) setStatus(next);
      })
      .catch(() => {
        // No status is the same as no server for display purposes.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = useCallback(() => {
    if (status?.url == null || status.token == null) return;
    void window.scamp
      .writeClipboard({ text: connectCommand(status.url, status.token) })
      // Only claim success when the write actually happened.
      .then(() => setCopied(true))
      .catch(() => undefined);
  }, [status]);

  // Absent rather than greyed out: with no server there is nothing to say,
  // and a permanently dead indicator is worse than none.
  if (status === null || !status.running || status.url === null) return null;

  const registered = status.registered;
  const tooltip = [
    'Scamp MCP server is running — your agent can query the live canvas.',
    registered.length > 0
      ? `Registered in ${registered.join(', ')}.`
      : 'No agent config was written; copy the connect command instead.',
    // Phase 0: a project-scoped server sits at "pending approval" until the
    // user approves it interactively. Without this line the tools look
    // broken for no visible reason.
    'First use may need approval inside your agent.',
    'Copy the connect command for agents Scamp cannot configure.',
  ].join(' ');

  return (
    <Tooltip label={tooltip}>
      <div className={styles.pill} data-testid="mcp-status" data-running="true">
        <span className={styles.dot} aria-hidden="true" />
        <span className={styles.label}>MCP</span>
        <button
          className={styles.copy}
          onClick={handleCopy}
          type="button"
          aria-label="Copy MCP connect command"
          data-action="copy-mcp-command"
          data-copied={copied ? 'true' : 'false'}
        >
          {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
        </button>
      </div>
    </Tooltip>
  );
};
