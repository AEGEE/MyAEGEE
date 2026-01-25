"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const getElementAttributeValue_1 = __importDefault(require("./getElementAttributeValue"));
function hasAriaLabel(node) {
    return ((0, getElementAttributeValue_1.default)(node, "aria-label") ||
        (0, getElementAttributeValue_1.default)(node, "aria-labelledby"));
}
exports.default = hasAriaLabel;
