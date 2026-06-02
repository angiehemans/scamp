import { describe, it, expect, beforeEach } from 'vitest';
import {
  selectAnyAgentActive,
  selectPauseReason,
  useTerminalActivityStore,
} from '@store/terminalActivitySlice';

const store = (): ReturnType<typeof useTerminalActivityStore.getState> =>
  useTerminalActivityStore.getState();

describe('terminalActivitySlice', () => {
  beforeEach(() => {
    useTerminalActivityStore.setState({
      foregroundByTerminal: {},
      userIntent: 'auto',
    });
  });

  it('starts empty in auto mode', () => {
    expect(store().foregroundByTerminal).toEqual({});
    expect(store().userIntent).toBe('auto');
    expect(selectAnyAgentActive(store())).toBe(false);
  });

  it('setForeground tracks the per-terminal value', () => {
    store().setForeground('1', 'claude');
    expect(store().foregroundByTerminal['1']).toBe('claude');
    expect(selectAnyAgentActive(store())).toBe(true);
  });

  it('setForeground(null) marks the terminal as idle', () => {
    store().setForeground('1', 'claude');
    store().setForeground('1', null);
    expect(store().foregroundByTerminal['1']).toBeNull();
    expect(selectAnyAgentActive(store())).toBe(false);
  });

  it('anyAgentActive is true when any terminal has a non-null value', () => {
    store().setForeground('1', null);
    store().setForeground('2', 'aider');
    expect(selectAnyAgentActive(store())).toBe(true);
  });

  it('anyAgentActive is false when all terminals are null', () => {
    store().setForeground('1', null);
    store().setForeground('2', null);
    expect(selectAnyAgentActive(store())).toBe(false);
  });

  it('removeTerminal drops the entry entirely', () => {
    store().setForeground('1', 'claude');
    store().setForeground('2', 'aider');
    store().removeTerminal('1');
    expect(store().foregroundByTerminal).toEqual({ '2': 'aider' });
    expect(selectAnyAgentActive(store())).toBe(true);
    store().removeTerminal('2');
    expect(selectAnyAgentActive(store())).toBe(false);
  });

  describe("userIntent = 'paused' (manual sync-pause)", () => {
    it("forces anyAgentActive true even with no terminal activity", () => {
      store().setUserIntent('paused');
      expect(selectAnyAgentActive(store())).toBe(true);
    });

    it("clears when intent goes back to auto", () => {
      store().setUserIntent('paused');
      store().setUserIntent('auto');
      expect(selectAnyAgentActive(store())).toBe(false);
    });

    it("stays true when an agent is also detected", () => {
      store().setUserIntent('paused');
      store().setForeground('1', 'claude');
      expect(selectAnyAgentActive(store())).toBe(true);
    });
  });

  describe("userIntent = 'resumed' (user override)", () => {
    it("forces anyAgentActive false even when a terminal is busy", () => {
      store().setForeground('1', 'claude');
      expect(selectAnyAgentActive(store())).toBe(true);
      store().setUserIntent('resumed');
      // User has acknowledged the agent and chosen to keep saving.
      expect(selectAnyAgentActive(store())).toBe(false);
    });

    it("stays false after the agent finishes (no flip-flop back to paused)", () => {
      store().setUserIntent('resumed');
      store().setForeground('1', 'claude');
      store().setForeground('1', null);
      expect(selectAnyAgentActive(store())).toBe(false);
    });
  });

  describe('selectPauseReason', () => {
    it('returns null when no pause signal is active', () => {
      expect(selectPauseReason(store())).toBeNull();
      store().setForeground('1', null);
      expect(selectPauseReason(store())).toBeNull();
    });

    it('returns agent-terminal when a foreground process is detected in auto mode', () => {
      store().setForeground('1', 'claude');
      expect(selectPauseReason(store())).toBe('agent-terminal');
    });

    it("returns manual when the user intent is 'paused'", () => {
      store().setUserIntent('paused');
      expect(selectPauseReason(store())).toBe('manual');
    });

    it("returns manual even when a foreground process is also detected", () => {
      // The user's explicit choice wins — they pressed Pause, so the
      // popover should reflect that, not the auto-detection.
      store().setUserIntent('paused');
      store().setForeground('1', 'claude');
      expect(selectPauseReason(store())).toBe('manual');
    });

    it("returns null when the user intent is 'resumed', regardless of detection", () => {
      store().setForeground('1', 'claude');
      store().setUserIntent('resumed');
      expect(selectPauseReason(store())).toBeNull();
    });
  });
});
