"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const aria_query_1 = require("aria-query");
const utils_1 = require("../utils");
const rule = {
    meta: {
        type: "problem",
        docs: {
            url: (0, utils_1.makeDocsURL)("aria-props")
        },
        messages: {
            default: "{{name}} This attribute is an invalid ARIA attribute."
        },
        schema: []
    },
    create(context) {
        return (0, utils_1.defineTemplateBodyVisitor)(context, {
            VAttribute(node) {
                const name = (0, utils_1.getAttributeName)(node);
                const lowered = name && name.toLowerCase();
                if (lowered &&
                    lowered.startsWith("aria-") &&
                    !aria_query_1.aria.has(lowered)) {
                    context.report({
                        node: node,
                        messageId: "default",
                        data: { name: name }
                    });
                }
            }
        });
    }
};
exports.default = rule;
