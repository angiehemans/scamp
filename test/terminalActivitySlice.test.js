import { describe, it, expect, beforeEach } from 'vitest';
import { selectAnyAgentActive, useTerminalActivityStore, } from '@store/terminalActivitySlice';
const store = () => useTerminalActivityStore.getState();
describe('terminalActivitySlice', () => {
    beforeEach(() => {
        useTerminalActivityStore.setState({ foregroundByTerminal: {} });
    });
    it('starts empty', () => {
        expect(store().foregroundByTerminal).toEqual({});
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
});
