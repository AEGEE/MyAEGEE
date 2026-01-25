"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function isAttribute(node, name) {
    if (!node.directive) {
        return node.key.name === name;
    }
    return (node.key.name.name === "bind" &&
        node.key.argument &&
        node.key.argument.type === "VIdentifier" &&
        node.key.argument.name === name);
}
exports.default = isAttribute;
