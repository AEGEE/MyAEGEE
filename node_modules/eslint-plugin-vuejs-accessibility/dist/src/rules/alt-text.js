"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../utils");
const ruleByElement = {
    img(context, node) {
        const altAttribute = (0, utils_1.getElementAttribute)(node, "alt");
        if (!altAttribute) {
            if ((0, utils_1.isPresentationRole)(node)) {
                context.report({ node: node, messageId: "imgPresentation" });
            }
            else {
                context.report({ node: node, messageId: "imgMissingAlt" });
            }
        }
        else {
            const altValue = (0, utils_1.getAttributeValue)(altAttribute);
            if (!altValue && altValue !== "") {
                context.report({ node: node, messageId: "imgInvalidAlt" });
            }
        }
    },
    object(context, node) {
        if (!(0, utils_1.hasAriaLabel)(node) &&
            !(0, utils_1.getElementAttributeValue)(node, "title") &&
            !(0, utils_1.hasAccessibleChild)(node)) {
            context.report({ node: node, messageId: "object" });
        }
    },
    area(context, node) {
        if (!(0, utils_1.hasAriaLabel)(node) && !(0, utils_1.getElementAttributeValue)(node, "alt")) {
            context.report({ node: node, messageId: "area" });
        }
    },
    'input[type="image"]'(context, node) {
        if ((0, utils_1.getElementAttributeValue)(node, "type") === "image" &&
            !(0, utils_1.hasAriaLabel)(node) &&
            !(0, utils_1.getElementAttributeValue)(node, "alt")) {
            context.report({ node: node, messageId: "input" });
        }
    }
};
const rule = {
    meta: {
        type: "problem",
        docs: {
            url: (0, utils_1.makeDocsURL)("alt-text")
        },
        messages: {
            area: "Each area of an image map must have a text alternative through the `alt`, `aria-label`, or `aria-labelledby` prop.",
            imgMissingAlt: "img elements must have an alt prop, either with meaningful text, or an empty string for decorative images.",
            imgInvalidAlt: `Invalid alt value for img. Use alt="" for presentational images.`,
            imgPresentation: `Prefer alt="" over a presentational role. First rule of aria is to not use aria if it can be achieved via native HTML.`,
            input: `<input> elements with type="image" must have a text alternative through the alt, aria-label, or aria-labelledby prop.`,
            object: "Embedded <object> elements must have alternative text by providing inner text, aria-label or aria-labelledby props."
        },
        schema: [
            {
                type: "object",
                properties: ["elements", ...Object.keys(ruleByElement)].reduce((accum, key) => Object.assign(accum, {
                    [key]: {
                        type: "array",
                        items: {
                            type: "string"
                        },
                        uniqueItems: true
                    }
                }), {})
            }
        ]
    },
    create(context) {
        const options = context.options[0] || {};
        const elements = options.elements || Object.keys(ruleByElement);
        // Here we're building up a list of element types and their corresponding
        // check function.
        const elementTypes = {};
        elements.forEach((element) => {
            const elementKey = element === 'input[type="image"]' ? "input" : element;
            elementTypes[elementKey] = element;
            (options[element] || []).forEach((matchedElement) => {
                elementTypes[(0, utils_1.makeKebabCase)(matchedElement)] = elementKey;
            });
        });
        return (0, utils_1.defineTemplateBodyVisitor)(context, {
            VElement(node) {
                const elementType = elementTypes[(0, utils_1.getElementType)(node)];
                elementType && ruleByElement[elementType](context, node);
            }
        });
    }
};
exports.default = rule;
