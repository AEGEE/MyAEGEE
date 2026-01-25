"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../utils");
const rule = {
    meta: {
        type: "problem",
        docs: {
            url: (0, utils_1.makeDocsURL)("iframe-has-title")
        },
        messages: {
            default: "<iframe> elements must have a unique title property."
        },
        schema: []
    },
    create(context) {
        return (0, utils_1.defineTemplateBodyVisitor)(context, {
            VElement(node) {
                if ((0, utils_1.getElementType)(node) !== "iframe") {
                    return;
                }
                const title = (0, utils_1.getElementAttributeValue)(node, "title");
                if (title === null || !["string", "object"].includes(typeof title)) {
                    context.report({ node: node, messageId: "default" });
                }
            }
        });
    }
};
exports.default = rule;
