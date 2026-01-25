"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const getElementAttribute_1 = __importDefault(require("./getElementAttribute"));
const getAttributeValue_1 = __importDefault(require("./getAttributeValue"));
function isHiddenFromScreenReader(node) {
    const attribute = (0, getElementAttribute_1.default)(node, "aria-hidden");
    if (!attribute) {
        return false;
    }
    const value = (0, getAttributeValue_1.default)(attribute);
    return (value || "").toString() !== "false";
}
exports.default = isHiddenFromScreenReader;
