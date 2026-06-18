import { type KeyframesBlock, type ScampElement } from "../element";
import { type Breakpoint } from "@shared/types";
export declare const generateCss: (elements: Record<string, ScampElement>, rootId: string, breakpoints: ReadonlyArray<Breakpoint>, customMediaBlocks: ReadonlyArray<string>, pageKeyframesBlocks: ReadonlyArray<KeyframesBlock>) => string;
