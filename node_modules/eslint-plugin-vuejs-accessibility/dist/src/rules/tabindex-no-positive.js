"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../utils");
const rule = {
    meta: {
        type: "problem",
        docs: {
            url: (0, utils_1.makeDocsURL)("tabindex-no-positive")
        },
        messages: {
            default: "Avoid positive integer values for tabindex."
        },
        schema: []
    },
    create(context) {
        return (0, utils_1.defineTemplateBodyVisitor)(context, {
            VElement(node) {
                const tabIndex = (0, utils_1.getLiteralAttributeValue)(node, "tabindex");
                if ((typeof tabIndex === "string" || typeof tabIndex === "number") &&
                    +tabIndex > 0) {
                    context.report({ node: node, messageId: "default" });
                }
            }
        });
    }
};
exports.default = rule;
