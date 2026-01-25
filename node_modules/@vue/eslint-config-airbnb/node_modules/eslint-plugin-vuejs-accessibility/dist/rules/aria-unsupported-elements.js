"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const aria_query_1 = require("aria-query");
const utils_1 = require("../utils");
const rule = {
    meta: {
        type: "problem",
        docs: {
            url: (0, utils_1.makeDocsURL)("aria-unsupported-elements")
        },
        messages: {
            default: `This element does not support ARIA roles, states, and properties. Try removing the "{{name}}" attribute.`
        },
        schema: []
    },
    create(context) {
        return (0, utils_1.defineTemplateBodyVisitor)(context, {
            VElement(node) {
                if (!(aria_query_1.dom.get((0, utils_1.getElementType)(node)) || {}).reserved) {
                    return;
                }
                node.startTag.attributes.forEach((attribute) => {
                    const name = (0, utils_1.getAttributeName)(attribute);
                    if (name && (aria_query_1.aria.has(name) || name === "role")) {
                        context.report({
                            node: node,
                            messageId: "default",
                            data: { name }
                        });
                    }
                });
            }
        });
    }
};
exports.default = rule;
