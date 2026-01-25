#! /usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// src/bin/cli.ts
var import_promises = require("fs/promises");

// src/index.ts
var import_xlsx2 = require("xlsx");

// src/config.ts
var fs = __toESM(require("fs"), 1);
var import_xlsx = require("xlsx");
(0, import_xlsx.set_fs)(fs);

// src/workbook.ts
var WorkBook = class {
  Sheets = {};
  SheetNames = [];
};

// src/index.ts
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

// src/bin/cli.ts
var [action = "build", ...args] = process.argv.slice(2);
var readStdin = async (bufferSize) => {
  return new Promise((resolve) => {
    const buffers = [];
    process.stdin.on("readable", () => {
      const read2 = process.stdin.read();
      if (read2) {
        buffers.push(read2);
      }
    });
    process.stdin.on("end", () => {
      resolve(Buffer.concat(buffers, bufferSize));
    });
  });
};
var main = async () => {
  switch (action) {
    case "build": {
      const stdin = JSON.parse((await readStdin()).toString("utf8"));
      const result = build(stdin);
      await (0, import_promises.writeFile)(args[0] || `${process.cwd()}/out.xlsx`, result);
      break;
    }
    default:
      console.log("Sorry, that is not something I know how to do.");
  }
  process.exit(0);
};
main();
//# sourceMappingURL=cli.cjs.map