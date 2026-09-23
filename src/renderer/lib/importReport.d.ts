import type { ImportReportGroup } from '@shared/types';
import type { ImportFinding } from './importReduce';
export declare const buildReport: (findings: ReadonlyArray<ImportFinding>) => ImportReportGroup[];
