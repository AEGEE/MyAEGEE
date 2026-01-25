import type { AST } from "vue-eslint-parser";
import type { ARIARoleRelationConcept } from "aria-query";
declare function matchesElementRole(node: AST.VElement, elementRole: ARIARoleRelationConcept): boolean;
export default matchesElementRole;
