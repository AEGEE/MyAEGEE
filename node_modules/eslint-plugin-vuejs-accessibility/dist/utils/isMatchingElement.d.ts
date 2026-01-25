import type { AST } from "vue-eslint-parser";
declare function isMatchingElement(node: AST.VElement | AST.VDocumentFragment | AST.VText | AST.VExpressionContainer, searchArray: string[]): boolean;
export default isMatchingElement;
