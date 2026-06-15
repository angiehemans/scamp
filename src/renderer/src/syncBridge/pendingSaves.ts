// syncBridge/pendingSaves.ts — split out of syncBridge.ts (5.4 safe partial).
import { useAppLogStore } from "@store/appLogSlice";
import { useSaveStatusStore, type LastWriteAttempt } from "@store/saveStatusSlice";

/**
 * Safety net for the "save is confirmed" transition. The main-process
 * watcher already emits an ack on its own 400 ms expiry, so the bridge
 * should receive one event per write even on filesystems that skip
 * the chokidar stability event. This larger window only catches the
 * case where IPC itself fails to deliver the ack.
 */
const ACK_WATCHDOG_MS = 2000;


/**
 * A write that has been dispatched but not yet fully confirmed. We
 * consider a write confirmed only when (a) the IPC promise resolves
 * AND (b) chokidar's stability event fires for every expected sibling
 * path. Tracking both prevents the indicator flashing green before the
 * OS actually settles on disk.
 */
type PendingSave = {
  attempt: LastWriteAttempt;
  ipcDone: boolean;
  acked: Set<string>;
  expected: Set<string>;
  watchdog: ReturnType<typeof setTimeout>;
};


const pendingSaves = new Map<string, PendingSave>();


/**
 * Acks that arrived before their `pendingSaves` entry could be
 * registered — chokidar's stability event can fire faster than the
 * IPC round-trip returns. Drained by the IPC `.then` callback when
 * the matching writeId finally registers.
 *
 * Each entry carries a self-expiry timer so background writes that
 * bypass the save-status pipeline (e.g. format-migration writes on
 * project open) don't leak their acks forever.
 */
type EarlyAck = {
  paths: Set<string>;
  timer: ReturnType<typeof setTimeout>;
};

const earlyAcks = new Map<string, EarlyAck>();

const EARLY_ACK_TTL_MS = 1000;


/**
 * Throttle for the aborted-write toast. A burst of canvas events
 * (e.g. a drag in progress) can fire writeIfDirty many times in
 * rapid succession; we only want ONE toast per external-edit
 * window. After the throttle interval the next abort can show
 * another toast.
 */
let lastAbortToastAt = 0;

const ABORT_TOAST_THROTTLE_MS = 4000;


export const notifyWriteAborted = (fileName: string): void => {
  const now = Date.now();
  if (now - lastAbortToastAt < ABORT_TOAST_THROTTLE_MS) return;
  lastAbortToastAt = now;
  useSaveStatusStore
    .getState()
    .showToast(
      `Your canvas change wasn't saved — ${fileName} was just edited externally.`
    );
};


const clearPending = (writeId: string): void => {
  const entry = pendingSaves.get(writeId);
  if (!entry) return;
  clearTimeout(entry.watchdog);
  pendingSaves.delete(writeId);
};


const maybeConfirm = (writeId: string): void => {
  const entry = pendingSaves.get(writeId);
  if (!entry) return;
  if (!entry.ipcDone) return;
  for (const path of entry.expected) {
    if (!entry.acked.has(path)) return;
  }
  clearPending(writeId);
  useSaveStatusStore.getState().markConfirmed();
};


export const handleAck = (writeId: string, path: string): void => {
  const entry = pendingSaves.get(writeId);
  if (entry) {
    entry.acked.add(path);
    maybeConfirm(writeId);
    return;
  }
  // Ack arrived before dispatch's `.then` registered the pending save
  // (fast filesystems can race chokidar ahead of IPC resolution), OR
  // the write was never tracked at all (e.g. format-migration writes
  // on project open bypass the indicator). Buffer with a short TTL
  // so dispatches can drain, but stray acks don't leak.
  const existing = earlyAcks.get(writeId);
  if (existing) {
    existing.paths.add(path);
    return;
  }
  const timer = setTimeout(() => {
    earlyAcks.delete(writeId);
  }, EARLY_ACK_TTL_MS);
  earlyAcks.set(writeId, { paths: new Set<string>([path]), timer });
};


export const reportError = (message: string, attempt: LastWriteAttempt): void => {
  useSaveStatusStore.getState().markError(message, attempt);
  useAppLogStore.getState().log('error', `Save failed: ${message}`);
};


/**
 * Record a just-dispatched write in the pending-saves map and check
 * whether it's already confirmable (acks that arrived before IPC
 * resolved land in `earlyAcks`).
 */
export const registerPendingSave = (
  writeId: string,
  attempt: LastWriteAttempt,
  expected: Set<string>
): void => {
  const entry: PendingSave = {
    attempt,
    ipcDone: true,
    acked: new Set<string>(),
    expected,
    watchdog: setTimeout(() => {
      if (!pendingSaves.has(writeId)) return;
      clearPending(writeId);
      reportError('No confirmation from disk watcher', attempt);
    }, ACK_WATCHDOG_MS),
  };
  const buffered = earlyAcks.get(writeId);
  if (buffered) {
    clearTimeout(buffered.timer);
    for (const p of buffered.paths) entry.acked.add(p);
    earlyAcks.delete(writeId);
  }
  pendingSaves.set(writeId, entry);
  maybeConfirm(writeId);
};

