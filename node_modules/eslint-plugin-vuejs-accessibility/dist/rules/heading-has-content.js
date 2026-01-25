"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../utils");
const headings = ["h1", "h2", "h3", "h4", "h5", "h6"];
const rule = {
    meta: {
        type: "problem",
        docs: {
            url: (0, utils_1.makeDocsURL)("heading-has-content")
        },
        messages: {
            default: "Headings must have content and the content must be accessible by a screen reader."
        },
        schema: [
            {
                type: "object",
                properties: {
                    components: {
                        type: "array",
                        items: { type: "string" }
                    },
                    accessibleChildren: {
                        type: "array",
                        items: { type: "string" }
                    },
                    accessibleDirectives: {
                        type: "array",
                        items: { type: "string" }
                    }
                }
            }
        ]
    },
    create(context) {
        return (0, utils_1.defineTemplateBodyVisitor)(context, {
            VElement(node) {
                const { components = [], accessibleChildren = [], accessibleDirectives = [] } = context.options[0] || {};
                const elementTypes = headings.concat(components.map(utils_1.makeKebabCase));
                const accessibleChildTypes = accessibleChildren.map(utils_1.makeKebabCase);
                const elementType = (0, utils_1.getElementType)(node);
                if (elementTypes.includes(elementType) &&
                    !(0, utils_1.hasContent)(node, accessibleChildTypes, accessibleDirectives)) {
                    context.report({ node: node, messageId: "default" });
                }
            }
        });
    }
};
exports.default = rule;
