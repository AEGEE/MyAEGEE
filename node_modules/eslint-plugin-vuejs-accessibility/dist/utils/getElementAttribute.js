"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function getElementAttribute(node, name) {
    for (const attribute of node.startTag.attributes) {
        if ((!attribute.directive && attribute.key.name === name) ||
            (attribute.directive &&
                attribute.key.name.name === "bind" &&
                attribute.key.argument &&
                attribute.key.argument.type === "VIdentifier" &&
                attribute.key.argument.name === name)) {
            return attribute;
        }
    }
    return null;
}
exports.default = getElementAttribute;
