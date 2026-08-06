import { type ToolDescriptor, type ToolInvoker } from './protocol';
export declare const TOOL_DESCRIPTORS: ToolDescriptor[];
/** Names the invoker will accept — derived so the two can never drift. */
export declare const TOOL_NAMES: ReadonlyArray<string>;
/**
 * Build the invoker the protocol layer calls.
 *
 * `runQuery` is injected — in the app it's the renderer round trip, in tests
 * it's a stub. Keeping the boundary here is what lets the whole tool surface
 * be tested without an Electron window.
 */
export declare const createToolInvoker: (runQuery: (tool: string, args: Record<string, unknown>) => Promise<unknown>) => ToolInvoker;
