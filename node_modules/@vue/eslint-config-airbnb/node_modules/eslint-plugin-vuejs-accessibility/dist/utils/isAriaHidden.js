"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const isHiddenFromScreenReader_1 = __importDefault(require("./isHiddenFromScreenReader"));
function isAriaHidden(node) {
    if (node.type !== "VElement") {
        return false;
    }
    return (0, isHiddenFromScreenReader_1.default)(node) || isAriaHidden(node.parent);
}
exports.default = isAriaHidden;
