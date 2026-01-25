#! /usr/bin/env node
import {
  build
} from "../chunk-ID6OMQGT.js";

// src/bin/cli.ts
import { writeFile } from "fs/promises";
var [action = "build", ...args] = process.argv.slice(2);
var readStdin = async (bufferSize) => {
  return new Promise((resolve) => {
    const buffers = [];
    process.stdin.on("readable", () => {
      const read = process.stdin.read();
      if (read) {
        buffers.push(read);
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
      await writeFile(args[0] || `${process.cwd()}/out.xlsx`, result);
      break;
    }
    default:
      console.log("Sorry, that is not something I know how to do.");
  }
  process.exit(0);
};
main();
//# sourceMappingURL=cli.js.map