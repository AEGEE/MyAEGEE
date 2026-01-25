import type { AST } from "vue-eslint-parser";
declare function hasContent(node: AST.VElement, accessibleChildTypes: string[], accessibleDirectives: string[]): boolean;
export default hasContent;
