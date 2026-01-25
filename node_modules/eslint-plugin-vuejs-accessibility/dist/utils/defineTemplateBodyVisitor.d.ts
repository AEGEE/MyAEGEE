import type { Rule } from "eslint";
import type { AST } from "vue-eslint-parser";
interface TemplateListener extends Rule.NodeListener {
    VAttribute?: (node: AST.VAttribute) => void;
    VElement?: (node: AST.VElement) => void;
    VText?: (node: AST.VText) => void;
}
declare function defineTemplateBodyVisitor(context: Rule.RuleContext, templateVisitor: TemplateListener, scriptVisitor?: Rule.RuleListener): any;
export default defineTemplateBodyVisitor;
