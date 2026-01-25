"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const getAttributeValue_1 = __importDefault(require("./getAttributeValue"));
const getElementAttribute_1 = __importDefault(require("./getElementAttribute"));
function getElementAttributeValue(node, name) {
    const attribute = (0, getElementAttribute_1.default)(node, name);
    return attribute && (0, getAttributeValue_1.default)(attribute);
}
exports.default = getElementAttributeValue;
