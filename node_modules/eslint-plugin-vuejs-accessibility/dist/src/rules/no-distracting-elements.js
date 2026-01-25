"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../utils");
const defaultElements = ["marquee", "blink"];
const rule = {
    meta: {
        type: "problem",
        docs: {
            url: (0, utils_1.makeDocsURL)("no-distracting-elements")
        },
        messages: {
            default: "Do not use <{{elementType}}> elements as they can create visual accessibility issues and are deprecated."
        },
        schema: [
            {
                type: "object",
                elements: {
                    type: "array",
                    items: {
                        type: "string",
                        enum: defaultElements
                    }
                }
            }
        ]
    },
    create(context) {
        return (0, utils_1.defineTemplateBodyVisitor)(context, {
            VElement(node) {
                const { elements = defaultElements } = context.options[0] || {};
                const elementType = (0, utils_1.getElementType)(node);
                if (elements.map(utils_1.makeKebabCase).includes(elementType)) {
                    context.report({
                        node: node,
                        messageId: "default",
                        data: { elementType }
                    });
                }
            }
        });
    }
};
exports.default = rule;
