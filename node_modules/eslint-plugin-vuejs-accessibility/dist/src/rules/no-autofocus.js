"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const aria_query_1 = require("aria-query");
const utils_1 = require("../utils");
const rule = {
    meta: {
        type: "problem",
        docs: {
            url: (0, utils_1.makeDocsURL)("no-autofocus")
        },
        messages: {
            default: "The autofocus prop should not be used, as it can reduce usability and accessibility for users."
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
                if (!(0, utils_1.isAttribute)(node, "autofocus")) {
                    return;
                }
                const { ignoreNonDOM } = context.options[0] || {};
                if (ignoreNonDOM && !aria_query_1.dom.has((0, utils_1.getElementType)(node.parent.parent))) {
                    return;
                }
                context.report({ node: node, messageId: "default" });
            }
        });
    }
};
exports.default = rule;
