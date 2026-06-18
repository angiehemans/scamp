import type { FileChangedPayload } from '@shared/types';
import type { SaveContext } from './saveContext';
export declare const makeFileChangedHandler: (ctx: SaveContext) => (payload: FileChangedPayload) => void;
