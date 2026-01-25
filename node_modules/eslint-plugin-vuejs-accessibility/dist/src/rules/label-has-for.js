"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../utils");
const controlTypes = ["input", "meter", "progress", "select", "textarea"];
function validateNesting(node, options) {
    return node.children.some((child) => {
        const { allowChildren, controlComponents } = options;
        if (child.type === "VElement" && child.rawName === "slot") {
            return allowChildren;
        }
        if (child.type === "VElement") {
            return (!(0, utils_1.isHiddenFromScreenReader)(child) &&
                (controlTypes
                    .concat(controlComponents)
                    .includes((0, utils_1.getElementType)(child)) ||
                    validateNesting(child, options)));
        }
        return false;
    });
}
function validate(node, rule, options) {
    switch (rule) {
        case "nesting":
            return validateNesting(node, options);
        case "id":
            return (0, utils_1.getElementAttributeValue)(node, "for");
        default:
            return false;
    }
}
function isValidLabel(node, required, options) {
    if (typeof required === "string") {
        return validate(node, required, options);
    }
    if (Array.isArray(required.some)) {
        return required.some.some((rule) => validate(node, rule, options));
    }
    if (Array.isArray(required.every)) {
        return required.every.every((rule) => validate(node, rule, options));
    }
}
const rule = {
    meta: {
        type: "problem",
        docs: {
            url: (0, utils_1.makeDocsURL)("label-has-for")
        },
        messages: {
            default: "Form label must have an associated control."
        },
        schema: [
            {
                type: "object",
                properties: {
                    components: {
                        type: "array",
                        items: {
                            type: "string"
                        },
                        uniqueItems: true
                    },
                    controlComponents: {
                        type: "array",
                        items: {
                            type: "string"
                        },
                        uniqueItems: true
                    },
                    required: {
                        oneOf: [
                            {
                                type: "string",
                                enum: ["nesting", "id"]
                            },
                            {
                                type: "object",
                                properties: {
                                    some: {
                                        type: "array",
                                        items: {
                                            type: "string",
                                            enum: ["nesting", "id"]
                                        },
                                        uniqueItems: true
                                    }
                                },
                                required: ["some"]
                            },
                            {
                                type: "object",
                                properties: {
                                    every: {
                                        type: "array",
                                        items: {
                                            type: "string",
                                            enum: ["nesting", "id"]
                                        },
                                        uniqueItems: true
                                    }
                                },
                                required: ["every"]
                            }
                        ]
                    },
                    allowChildren: {
                        type: "boolean"
                    }
                }
            }
        ]
    },
    create(context) {
        return (0, utils_1.defineTemplateBodyVisitor)(context, {
            VElement(node) {
                const { allowChildren = false, components = [], controlComponents = [], required = { every: ["nesting", "id"] } } = context.options[0] || {};
                const labelComponents = components.map(utils_1.makeKebabCase).concat("label");
                const options = {
                    allowChildren,
                    controlComponents: controlComponents.map(utils_1.makeKebabCase)
                };
                if (labelComponents.includes((0, utils_1.getElementType)(node)) &&
                    !isValidLabel(node, required, options)) {
                    context.report({ node: node, messageId: "default" });
                }
            }
        });
    }
};
exports.default = rule;
