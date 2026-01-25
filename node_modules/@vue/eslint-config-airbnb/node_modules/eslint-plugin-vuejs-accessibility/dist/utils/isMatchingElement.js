"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const getElementType_1 = __importDefault(require("./getElementType"));
const makeKebabCase_1 = __importDefault(require("./makeKebabCase"));
function isMatchingElement(node, searchArray) {
    if (!(node.type === "VElement"))
        return false;
    const elementType = (0, getElementType_1.default)(node);
    return searchArray.some((item) => {
        return (0, makeKebabCase_1.default)(item) === elementType;
    });
}
exports.default = isMatchingElement;
