import { type LastWriteAttempt } from "@store/saveStatusSlice";
export declare const notifyWriteAborted: (fileName: string) => void;
export declare const handleAck: (writeId: string, path: string) => void;
export declare const reportError: (message: string, attempt: LastWriteAttempt) => void;
/**
 * Record a just-dispatched write in the pending-saves map and check
 * whether it's already confirmable (acks that arrived before IPC
 * resolved land in `earlyAcks`).
 */
export declare const registerPendingSave: (writeId: string, attempt: LastWriteAttempt, expected: Set<string>) => void;
