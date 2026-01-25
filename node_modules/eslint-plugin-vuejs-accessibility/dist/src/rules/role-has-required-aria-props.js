"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const aria_query_1 = require("aria-query");
const utils_1 = require("../utils");
function hasAttributes(node, names) {
    return names.every((name) => (0, utils_1.getElementAttribute)(node, name) !== null);
}
function isAriaRoleDefinitionKey(role) {
    return aria_query_1.roles.has(role);
}
const rule = {
    meta: {
        type: "problem",
        docs: {
            url: (0, utils_1.makeDocsURL)("role-has-required-aria-props")
        },
        messages: {
            default: `Elements with the ARIA role "{{role}}" must have the following attributes defined: {{attributes}}`
        },
        schema: []
    },
    create(context) {
        return (0, utils_1.defineTemplateBodyVisitor)(context, {
            VElement(node) {
                const elementType = (0, utils_1.getElementType)(node);
                if (!aria_query_1.dom.get(elementType)) {
                    return;
                }
                const roleValue = (0, utils_1.getElementAttributeValue)(node, "role");
                if (!roleValue || typeof roleValue !== "string") {
                    return;
                }
                roleValue
                    .toLowerCase()
                    .split(" ")
                    .forEach((role) => {
                    if (isAriaRoleDefinitionKey(role)) {
                        const roleDefinition = aria_query_1.roles.get(role);
                        const requiredProps = Object.keys(roleDefinition.requiredProps);
                        if (requiredProps && !hasAttributes(node, requiredProps)) {
                            context.report({
                                node: node,
                                messageId: "default",
                                data: {
                                    role: role.toLowerCase(),
                                    attributes: requiredProps.join(", ").toLowerCase()
                                }
                            });
                        }
                    }
                });
            }
        });
    }
};
exports.default = rule;
