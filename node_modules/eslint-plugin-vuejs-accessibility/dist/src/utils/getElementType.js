"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const getElementAttributeValue_1 = __importDefault(require("./getElementAttributeValue"));
const makeKebabCase_1 = __importDefault(require("./makeKebabCase"));
/**
 * Returns a kebab-normalized string representing the element node name
 * or, if the `is` attribute is a string, its value if present.
 * @example <div is="foo-bar"> => "foo-bar"
 * @example <foo-bar> => "foo-bar"
 * @example <div> => "div"
 */
function getElementType(node) {
    let is = (0, getElementAttributeValue_1.default)(node, "is");
    // If we could not parse the `is` value into a simple literal, we're going to
    // have to ignore it because we're not smart enough to handle multiple values
    // yet.
    if (typeof is !== "string") {
        is = null;
    }
    return (0, makeKebabCase_1.default)(is || node.rawName);
}
exports.default = getElementType;
