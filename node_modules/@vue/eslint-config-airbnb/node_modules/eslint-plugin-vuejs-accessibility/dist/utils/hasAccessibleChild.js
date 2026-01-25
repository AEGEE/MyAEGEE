"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const getElementType_1 = __importDefault(require("./getElementType"));
const isHiddenFromScreenReader_1 = __importDefault(require("./isHiddenFromScreenReader"));
function hasAccessibleChild(node, accessibleChildTypes = []) {
    return node.children.some((child) => {
        switch (child.type) {
            case "VText":
                return child.value.trim().length > 0;
            case "VElement": {
                const elementType = (0, getElementType_1.default)(child);
                return (accessibleChildTypes.includes(elementType) ||
                    child.rawName === "slot" ||
                    (!(0, isHiddenFromScreenReader_1.default)(child) &&
                        hasAccessibleChild(child, accessibleChildTypes)));
            }
            case "VExpressionContainer":
                if (child.expression && child.expression.type === "Identifier") {
                    return child.expression.name !== "undefined";
                }
                return true;
            default:
                return false;
        }
    });
}
exports.default = hasAccessibleChild;
