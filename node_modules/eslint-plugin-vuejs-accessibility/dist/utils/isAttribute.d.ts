import type { AST } from "vue-eslint-parser";
declare function isAttribute(node: AST.VAttribute | AST.VDirective, name: string): boolean | null;
export default isAttribute;
