import { describe, expect, it } from 'vitest';
import { claudeCodeDisablesServer } from '../src/main/mcp/agentConfig';
/**
 * The file Claude Code writes when the user declines its `.mcp.json`
 * prompt. Observed verbatim on a real machine: `{"disabledMcpjsonServers":
 * ["scamp"]}` — after which the agent never connects while Scamp's own
 * indicator still said "running".
 */
describe('claudeCodeDisablesServer', () => {
    it('detects our server in disabledMcpjsonServers', () => {
        expect(claudeCodeDisablesServer('{"disabledMcpjsonServers": ["scamp"]}')).toBe(true);
    });
    it('is not fooled by other servers being disabled', () => {
        expect(claudeCodeDisablesServer('{"disabledMcpjsonServers": ["pencil"]}')).toBe(false);
    });
    it('treats an enabled entry as not disabled', () => {
        expect(claudeCodeDisablesServer('{"enabledMcpjsonServers": ["scamp"]}')).toBe(false);
    });
    it('reads an absent file as not disabled', () => {
        expect(claudeCodeDisablesServer(null)).toBe(false);
    });
    it('reads an empty file as not disabled', () => {
        expect(claudeCodeDisablesServer('')).toBe(false);
    });
    it('reads malformed JSON as not disabled rather than throwing', () => {
        expect(claudeCodeDisablesServer('{ not json')).toBe(false);
    });
    it('reads a non-object document as not disabled', () => {
        expect(claudeCodeDisablesServer('["scamp"]')).toBe(false);
        expect(claudeCodeDisablesServer('"scamp"')).toBe(false);
    });
    it('reads a non-array disabled list as not disabled', () => {
        expect(claudeCodeDisablesServer('{"disabledMcpjsonServers": "scamp"}')).toBe(false);
    });
});
