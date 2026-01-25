import type { AST } from "vue-eslint-parser";
declare function getElementAttribute(node: AST.VElement, name: string): AST.VAttribute | AST.VDirective | null;
export default getElementAttribute;
