"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function getLiteralAttributeValue(node, name) {
    for (const attribute of node.startTag.attributes) {
        if (!attribute.directive &&
            attribute.key.name === name &&
            attribute.value) {
            return attribute.value.value;
        }
        if (attribute.directive &&
            attribute.key.name.name === "bind" &&
            attribute.key.argument &&
            attribute.key.argument.type === "VIdentifier" &&
            attribute.key.argument.name === name &&
            attribute.value &&
            attribute.value.expression &&
            attribute.value.expression.type === "Literal") {
            return attribute.value.expression.value;
        }
    }
    return null;
}
exports.default = getLiteralAttributeValue;
