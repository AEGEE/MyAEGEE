// istanbul-lib-source-maps has no types of its own; this is the part scripts/coverage.ts uses.
declare module 'istanbul-lib-source-maps' {
    import type { CoverageMap } from 'istanbul-lib-coverage';

    export interface MapStore {
        // Moves coverage of generated code to the sources named by each file's `inputSourceMap`.
        transformCoverage(coverageMap: CoverageMap): Promise<CoverageMap>;
    }

    export function createSourceMapStore(options?: Record<string, unknown>): MapStore;
}
