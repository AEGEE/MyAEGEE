"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const htmlElements_json_1 = __importDefault(require("../utils/htmlElements.json"));
const utils_1 = require("../utils");
// Why can I not import this like normal? Unclear.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const vueEslintParser = require("vue-eslint-parser");
function isHtmlElementNode(node) {
    return node.namespace === vueEslintParser.AST.NS.HTML;
}
function isCustomComponent(node) {
    return ((isHtmlElementNode(node) && !htmlElements_json_1.default.includes(node.rawName)) ||
        !!(0, utils_1.getElementAttribute)(node, "is"));
}
const rule = {
    meta: {
        type: "problem",
        docs: {
            url: (0, utils_1.makeDocsURL)("click-events-have-key-events")
        },
        messages: {
            default: "Visible, non-interactive elements with click handlers must have at least one keyboard listener."
        },
        schema: []
    },
    create(context) {
        return (0, utils_1.defineTemplateBodyVisitor)(context, {
            VElement(node) {
                if (!isCustomComponent(node) &&
                    (0, utils_1.hasOnDirective)(node, "click") &&
                    !(0, utils_1.isHiddenFromScreenReader)(node) &&
                    !(0, utils_1.isPresentationRole)(node) &&
                    !(0, utils_1.isInteractiveElement)(node) &&
                    !(0, utils_1.hasOnDirectives)(node, ["keydown", "keyup", "keypress"])) {
                    context.report({ node: node, messageId: "default" });
                }
            }
        });
    }
};
exports.default = rule;
