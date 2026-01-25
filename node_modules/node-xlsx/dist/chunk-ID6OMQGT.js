// src/index.ts
import {
  read,
  readFile,
  utils,
  write
} from "xlsx";

// src/config.ts
import * as fs from "fs";
import { set_fs } from "xlsx";
set_fs(fs);

// src/helpers.ts
var isString = (maybeString) => typeof maybeString === "string";

// src/workbook.ts
var WorkBook = class {
  Sheets = {};
  SheetNames = [];
};

// src/index.ts
var parse = (mixed, options = {}) => {
  const { dateNF, header = 1, range, blankrows, defval, raw = true, rawNumbers, ...otherOptions } = options;
  const workBook = isString(mixed) ? readFile(mixed, { dateNF, raw, ...otherOptions }) : read(mixed, { dateNF, raw, ...otherOptions });
  return Object.keys(workBook.Sheets).map((name) => {
    const sheet = workBook.Sheets[name];
    return {
      name,
      data: utils.sheet_to_json(sheet, {
        dateNF,
        header,
        range: typeof range === "function" ? range(sheet) : range,
        blankrows,
        defval,
        raw,
        rawNumbers
      })
    };
  });
};
var parseMetadata = (mixed, options = {}) => {
  const workBook = isString(mixed) ? readFile(mixed, options) : read(mixed, options);
  return Object.keys(workBook.Sheets).map((name) => {
    const sheet = workBook.Sheets[name];
    return { name, data: sheet["!ref"] ? utils.decode_range(sheet["!ref"]) : null };
  });
};
var build = (worksheets, { parseOptions = {}, writeOptions = {}, sheetOptions = {}, ...otherOptions } = {}) => {
  const { bookType = "xlsx", bookSST = false, type = "buffer", ...otherWriteOptions } = writeOptions;
  const legacyOptions = Object.keys(otherOptions).filter((key) => {
    if (["!cols", "!rows", "!merges", "!protect", "!autofilter"].includes(key)) {
      console.debug(`Deprecated options['${key}'], please use options.sheetOptions['${key}'] instead.`);
      return true;
    }
    console.debug(`Unknown options['${key}'], please use options.parseOptions / options.writeOptions`);
    return false;
  });
  const workBook = worksheets.reduce((soFar, { name, data, options = {} }, index) => {
    const sheetName = name || `Sheet_${index}`;
    const sheetData = utils.aoa_to_sheet(data, parseOptions);
    soFar.SheetNames.push(sheetName);
    soFar.Sheets[sheetName] = sheetData;
    Object.assign(soFar.Sheets[sheetName], legacyOptions, sheetOptions, options);
    return soFar;
  }, new WorkBook());
  return write(workBook, { bookType, bookSST, type, ...otherWriteOptions });
};
var src_default = { parse, parseMetadata, build };

export {
  parse,
  parseMetadata,
  build,
  src_default
};
//# sourceMappingURL=chunk-ID6OMQGT.js.map