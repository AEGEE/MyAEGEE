import type { AST } from "vue-eslint-parser";
declare function getAttributeName(node: AST.VAttribute | AST.VDirective): string | null;
export default getAttributeName;
