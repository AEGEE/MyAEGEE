"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const getElementAttributeValue_1 = __importDefault(require("./getElementAttributeValue"));
const getElementType_1 = __importDefault(require("./getElementType"));
const hasAccessibleChild_1 = __importDefault(require("./hasAccessibleChild"));
const isHiddenFromScreenReader_1 = __importDefault(require("./isHiddenFromScreenReader"));
function hasDirective(node, name) {
    return node.startTag.attributes.some((attribute) => attribute.directive && attribute.key.name.name === name.toLowerCase());
}
function hasChildWithDirective(node, name) {
    return node.children.some((child) => child.type === "VElement" &&
        (hasDirective(child, name) || hasChildWithDirective(child, name)));
}
function hasChildImageWithAlt(node) {
    return node.children.some((child) => {
        if (child.type === "VElement") {
            if (!(0, isHiddenFromScreenReader_1.default)(child) &&
                (0, getElementType_1.default)(child) === "img" &&
                (0, getElementAttributeValue_1.default)(child, "alt")) {
                return true;
            }
            return hasChildImageWithAlt(child);
        }
    });
}
function hasAccessibleDirective(node, accessibleDirectives) {
    return accessibleDirectives.some((directive) => {
        return hasDirective(node, directive);
    });
}
function hasContent(node, accessibleChildTypes, accessibleDirectives) {
    return ((0, hasAccessibleChild_1.default)(node, accessibleChildTypes) ||
        hasAccessibleDirective(node, accessibleDirectives) ||
        hasDirective(node, "text") ||
        hasDirective(node, "html") ||
        hasChildWithDirective(node, "text") ||
        hasChildWithDirective(node, "html") ||
        hasChildImageWithAlt(node));
}
exports.default = hasContent;
