"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function getAttributeName(node) {
    if (!node.directive) {
        return node.key.name;
    }
    const { key } = node;
    if (key.name.name === "bind" &&
        key.argument &&
        key.argument.type === "VIdentifier") {
        return key.argument.name;
    }
    return null;
}
exports.default = getAttributeName;
