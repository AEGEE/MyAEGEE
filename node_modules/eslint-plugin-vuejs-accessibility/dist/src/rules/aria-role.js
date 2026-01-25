"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const aria_query_1 = require("aria-query");
const utils_1 = require("../utils");
function isValidRole(value) {
    const ariaRole = aria_query_1.roles.get(value);
    return ariaRole && !ariaRole.abstract;
}
const rule = {
    meta: {
        type: "problem",
        docs: {
            url: (0, utils_1.makeDocsURL)("aria-role")
        },
        messages: {
            default: "Elements with ARIA roles must use a valid, non-abstract ARIA role."
        },
        schema: [
            {
                type: "object",
                properties: {
                    ignoreNonDOM: {
                        type: "boolean",
                        default: true
                    }
                },
                additionalProperties: false
            }
        ]
    },
    create(context) {
        return (0, utils_1.defineTemplateBodyVisitor)(context, {
            VAttribute(node) {
                const { ignoreNonDOM } = context.options[0] || {};
                if (ignoreNonDOM && !aria_query_1.dom.has((0, utils_1.getElementType)(node.parent.parent))) {
                    return;
                }
                if (!(0, utils_1.isAttribute)(node, "role")) {
                    return;
                }
                const value = (0, utils_1.getAttributeValue)(node);
                if (typeof value !== "string") {
                    return;
                }
                if (!value.toLowerCase().split(" ").every(isValidRole)) {
                    context.report({ node: node, messageId: "default" });
                }
            }
        });
    }
};
exports.default = rule;
