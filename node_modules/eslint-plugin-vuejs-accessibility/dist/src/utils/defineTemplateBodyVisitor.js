"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
// Taken directly from eslint-plugin-vue
function defineTemplateBodyVisitor(context, templateVisitor, scriptVisitor) {
    if (!context.parserServices.defineTemplateBodyVisitor) {
        if (path_1.default.extname(context.getFilename()) === ".vue") {
            context.report({
                loc: { line: 1, column: 0 },
                message: "Use the latest vue-eslint-parser. See also https://eslint.vuejs.org/user-guide/#what-is-the-use-the-latest-vue-eslint-parser-error."
            });
        }
        return {};
    }
    return context.parserServices.defineTemplateBodyVisitor(templateVisitor, scriptVisitor);
}
exports.default = defineTemplateBodyVisitor;
