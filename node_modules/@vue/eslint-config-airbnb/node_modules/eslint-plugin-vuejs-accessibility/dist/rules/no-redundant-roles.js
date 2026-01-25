"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const aria_query_1 = require("aria-query");
const utils_1 = require("../utils");
const exceptions = { nav: ["navigation"] };
function getImplicitRoleSet(node) {
    for (const [elementRole, roleSet] of aria_query_1.elementRoles.entries()) {
        if ((0, utils_1.matchesElementRole)(node, elementRole)) {
            // The types for this are wrong, it's actually a string[]
            return roleSet;
        }
    }
    return null;
}
const rule = {
    meta: {
        type: "problem",
        docs: {
            url: (0, utils_1.makeDocsURL)("no-redundant-roles")
        },
        messages: {
            default: "The element {{type}} has an implicit role of {{role}}. Defining this explicitly is redundant and should be avoided."
        },
        schema: [
            {
                type: "object",
                additionalProperties: {
                    type: "array",
                    items: {
                        type: "string"
                    },
                    uniqueItems: true
                }
            }
        ]
    },
    create(context) {
        return (0, utils_1.defineTemplateBodyVisitor)(context, {
            VElement(node) {
                const type = (0, utils_1.getElementType)(node);
                const implicitRoleSet = getImplicitRoleSet(node);
                const explicitRole = (0, utils_1.getElementAttributeValue)(node, "role");
                if (!implicitRoleSet || !explicitRole) {
                    return;
                }
                const permittedRoles = context.options[0] || {};
                if ((permittedRoles[type] || [])
                    .concat(exceptions[type] || [])
                    .includes(explicitRole)) {
                    return;
                }
                if (implicitRoleSet.includes(explicitRole)) {
                    context.report({
                        node: node,
                        messageId: "default",
                        data: { type, role: explicitRole.toString() }
                    });
                }
            }
        });
    }
};
exports.default = rule;
