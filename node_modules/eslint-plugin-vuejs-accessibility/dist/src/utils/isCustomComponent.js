"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const htmlElements_json_1 = __importDefault(require("./htmlElements.json"));
const utils_1 = require("../utils");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const vueEslintParser = require("vue-eslint-parser");
function isHtmlElementNode(node) {
    return node.namespace === vueEslintParser.AST.NS.HTML;
}
function isCustomComponent(node) {
    return ((isHtmlElementNode(node) && !htmlElements_json_1.default.includes(node.rawName)) ||
        !!(0, utils_1.getElementAttribute)(node, "is"));
}
exports.default = isCustomComponent;
