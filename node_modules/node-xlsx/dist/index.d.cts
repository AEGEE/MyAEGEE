import { Sheet2JSONOpts, ParsingOptions, Range, ColInfo, RowInfo, ProtectInfo, AutoFilterInfo, AOA2SheetOpts, WritingOptions } from 'xlsx';

declare const parse: <T = any[]>(mixed: unknown, options?: Sheet2JSONOpts & ParsingOptions) => {
    name: string;
    data: T[];
}[];
declare const parseMetadata: (mixed: unknown, options?: ParsingOptions) => {
    name: string;
    data: Range | null;
}[];
type WorkSheetOptions = {
    /** Column Info */
    "!cols"?: ColInfo[];
    /** Row Info */
    "!rows"?: RowInfo[];
    /** Merge Ranges */
    "!merges"?: Range[];
    /** Worksheet Protection info */
    "!protect"?: ProtectInfo;
    /** AutoFilter info */
    "!autofilter"?: AutoFilterInfo;
};
type WorkSheet<T = unknown> = {
    name: string;
    data: T[][];
    options: WorkSheetOptions;
};
type BuildOptions = WorkSheetOptions & {
    parseOptions?: AOA2SheetOpts;
    writeOptions?: WritingOptions;
    sheetOptions?: WorkSheetOptions;
};
declare const build: (worksheets: WorkSheet[], { parseOptions, writeOptions, sheetOptions, ...otherOptions }?: BuildOptions) => Buffer;
declare const _default: {
    parse: <T = any[]>(mixed: unknown, options?: Sheet2JSONOpts & ParsingOptions) => {
        name: string;
        data: T[];
    }[];
    parseMetadata: (mixed: unknown, options?: ParsingOptions) => {
        name: string;
        data: Range | null;
    }[];
    build: (worksheets: WorkSheet<unknown>[], { parseOptions, writeOptions, sheetOptions, ...otherOptions }?: BuildOptions) => Buffer;
};

export { type BuildOptions, type WorkSheet, type WorkSheetOptions, build, _default as default, parse, parseMetadata };
