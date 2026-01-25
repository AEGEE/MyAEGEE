"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const getElementType_1 = __importDefault(require("./getElementType"));
const getElementAttributeValue_1 = __importDefault(require("./getElementAttributeValue"));
function matchesElementRole(node, elementRole) {
    const { name, attributes } = elementRole;
    if (name !== (0, getElementType_1.default)(node)) {
        return false;
    }
    return (attributes || []).every((attribute) => {
        const value = (0, getElementAttributeValue_1.default)(node, attribute.name);
        if (attribute.value) {
            return value === attribute.value;
        }
        if (attribute.constraints) {
            // TODO: We shouldn't have to cast this to any. Are we using the wrong
            // comparison function here? Is this maybe for an old version of
            // aria-query?
            const constraint = attribute.constraints[0];
            switch (constraint) {
                case "set":
                    return value;
                case "undefined":
                    return !value;
                default:
                    return null;
            }
        }
        return value;
    });
}
exports.default = matchesElementRole;
