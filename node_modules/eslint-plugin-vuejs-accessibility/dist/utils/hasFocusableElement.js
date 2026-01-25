"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const getElementAttributeValue_1 = __importDefault(require("./getElementAttributeValue"));
const isInteractiveElement_1 = __importDefault(require("./isInteractiveElement"));
function hasFocusableElements(node) {
    const tabindex = (0, getElementAttributeValue_1.default)(node, "tabindex");
    if ((0, isInteractiveElement_1.default)(node)) {
        return tabindex !== "-1";
    }
    if (tabindex !== null && tabindex !== "-1") {
        return true;
    }
    return node.children.some((child) => child.type === "VElement" && hasFocusableElements(child));
}
exports.default = hasFocusableElements;
