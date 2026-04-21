import { describe, it, expect, beforeEach } from 'vitest';
import {
  useSaveStatusStore,
  type LastWriteAttempt,
} from '@store/saveStatusSlice';

const makeWriteAttempt = (): LastWriteAttempt => ({
  kind: 'write',
  tsxPath: '/tmp/home.tsx',
  cssPath: '/tmp/home.module.css',
  tsxContent: '<div />',
  cssContent: '.root {}',
});

const makePatchAttempt = (): LastWriteAttempt => ({
  kind: 'patch',
  cssPath: '/tmp/home.module.css',
  className: 'rect_a1b2',
  newDeclarations: 'background: red;',
});

const store = (): ReturnType<typeof useSaveStatusStore.getState> =>
  useSaveStatusStore.getState();

describe('saveStatusSlice', () => {
  beforeEach(() => {
    useSaveStatusStore.setState({ state: { kind: 'saved' } });
  });

  describe('happy path', () => {
    it('transitions saved → unsaved → saving → saved on a full write cycle', () => {
      expect(store().state).toEqual({ kind: 'saved' });

      store().markUnsaved();
      expect(store().state).toEqual({ kind: 'unsaved' });

      const attempt = makeWriteAttempt();
      store().markSaving(attempt);
      expect(store().state).toEqual({ kind: 'saving', attempt });

      store().markConfirmed();
      expect(store().state).toEqual({ kind: 'saved' });
    });

    it('skips straight from unsaved → saved when markClean is called', () => {
      store().markUnsaved();
      store().markClean();
      expect(store().state).toEqual({ kind: 'saved' });
    });
  });

  describe('error path', () => {
    it('transitions saving → error and retains the attempt for retry', () => {
      const attempt = makeWriteAttempt();
      store().markSaving(attempt);
      store().markError('disk full', attempt);

      expect(store().state).toEqual({
        kind: 'error',
        message: 'disk full',
        lastAttempt: attempt,
      });
    });

    it('keeps the error state visible through a subsequent unsaved edit', () => {
      const attempt = makeWriteAttempt();
      store().markError('disk full', attempt);
      store().markUnsaved();
      expect(store().state.kind).toBe('error');
    });

    it('clears the error state when a later save confirms', () => {
      const attempt = makeWriteAttempt();
      store().markError('disk full', attempt);
      store().markSaving(attempt);
      expect(store().state.kind).toBe('saving');
      store().markConfirmed();
      expect(store().state).toEqual({ kind: 'saved' });
    });
  });

  describe('markClean guards', () => {
    it('does not flip saving or error states to saved', () => {
      const attempt = makePatchAttempt();
      store().markSaving(attempt);
      store().markClean();
      expect(store().state.kind).toBe('saving');

      store().markError('bad', attempt);
      store().markClean();
      expect(store().state.kind).toBe('error');
    });

    it('leaves saved unchanged', () => {
      store().markClean();
      expect(store().state).toEqual({ kind: 'saved' });
    });
  });

  describe('markConfirmed guards', () => {
    it('is a no-op when no save is in flight', () => {
      store().markConfirmed();
      expect(store().state).toEqual({ kind: 'saved' });

      store().markUnsaved();
      store().markConfirmed();
      expect(store().state).toEqual({ kind: 'unsaved' });
    });

    it('does not override a pending error', () => {
      const attempt = makeWriteAttempt();
      store().markError('bad', attempt);
      store().markConfirmed();
      expect(store().state.kind).toBe('error');
    });
  });

  describe('markUnsaved guards', () => {
    it('does not interrupt an in-flight save', () => {
      const attempt = makeWriteAttempt();
      store().markSaving(attempt);
      store().markUnsaved();
      expect(store().state).toEqual({ kind: 'saving', attempt });
    });
  });

  describe('patch attempts', () => {
    it('stores the full patch attempt on markSaving for retry', () => {
      const attempt = makePatchAttempt();
      store().markSaving(attempt);
      expect(store().state).toEqual({ kind: 'saving', attempt });

      store().markError('parse failed', attempt);
      expect(store().state).toEqual({
        kind: 'error',
        message: 'parse failed',
        lastAttempt: attempt,
      });
    });
  });
});
