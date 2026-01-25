"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function hasOnDirective(node, name) {
    return node.startTag.attributes.some((attribute) => {
        return (attribute.directive &&
            attribute.key.name.name === "on" &&
            attribute.key.argument &&
            attribute.key.argument.type === "VIdentifier" &&
            attribute.key.argument.name === name &&
            attribute.value &&
            attribute.value.expression &&
            (attribute.value.expression.type === "Identifier" ||
                !!attribute.value.expression.body));
    });
}
exports.default = hasOnDirective;
