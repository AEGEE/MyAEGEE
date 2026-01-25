"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  build: () => build,
  default: () => src_default,
  parse: () => parse,
  parseMetadata: () => parseMetadata
});
module.exports = __toCommonJS(src_exports);
var import_xlsx2 = require("xlsx");

// src/config.ts
var fs = __toESM(require("fs"), 1);
var import_xlsx = require("xlsx");
(0, import_xlsx.set_fs)(fs);

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
  const workBook = isString(mixed) ? (0, import_xlsx2.readFile)(mixed, { dateNF, raw, ...otherOptions }) : (0, import_xlsx2.read)(mixed, { dateNF, raw, ...otherOptions });
  return Object.keys(workBook.Sheets).map((name) => {
    const sheet = workBook.Sheets[name];
    return {
      name,
      data: import_xlsx2.utils.sheet_to_json(sheet, {
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
  const workBook = isString(mixed) ? (0, import_xlsx2.readFile)(mixed, options) : (0, import_xlsx2.read)(mixed, options);
  return Object.keys(workBook.Sheets).map((name) => {
    const sheet = workBook.Sheets[name];
    return { name, data: sheet["!ref"] ? import_xlsx2.utils.decode_range(sheet["!ref"]) : null };
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
    const sheetData = import_xlsx2.utils.aoa_to_sheet(data, parseOptions);
    soFar.SheetNames.push(sheetName);
    soFar.Sheets[sheetName] = sheetData;
    Object.assign(soFar.Sheets[sheetName], legacyOptions, sheetOptions, options);
    return soFar;
  }, new WorkBook());
  return (0, import_xlsx2.write)(workBook, { bookType, bookSST, type, ...otherWriteOptions });
};
var src_default = { parse, parseMetadata, build };
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  build,
  parse,
  parseMetadata
});
//# sourceMappingURL=index.cjs.map