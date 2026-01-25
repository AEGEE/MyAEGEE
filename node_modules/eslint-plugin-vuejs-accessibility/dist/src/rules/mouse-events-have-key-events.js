"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../utils");
const rule = {
    meta: {
        type: "problem",
        docs: {
            url: (0, utils_1.makeDocsURL)("mouse-events-have-key-events")
        },
        messages: {
            mouseOver: "@mouseover, @mouseenter, or @hover must be accompanied by @focusin or @focus for accessibility.",
            mouseOut: "@mouseout or @mouseleave must be accompanied by @focusout or @blur for accessibility."
        },
        schema: []
    },
    create(context) {
        return (0, utils_1.defineTemplateBodyVisitor)(context, {
            VElement(node) {
                if ((0, utils_1.hasOnDirectives)(node, ["mouseover", "mouseenter", "hover"]) &&
                    !(0, utils_1.hasOnDirectives)(node, ["focus", "focusin"])) {
                    context.report({ node: node, messageId: "mouseOver" });
                }
                if ((0, utils_1.hasOnDirectives)(node, ["mouseout", "mouseleave"]) &&
                    !(0, utils_1.hasOnDirectives)(node, ["blur", "focusout"])) {
                    context.report({ node: node, messageId: "mouseOut" });
                }
            }
        });
    }
};
exports.default = rule;
